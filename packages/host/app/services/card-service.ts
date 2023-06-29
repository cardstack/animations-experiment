import Service, { service } from '@ember/service';
import { stringify } from 'qs';
import type LoaderService from './loader-service';
import {
  SupportedMimeType,
  type LooseCardResource,
  isSingleCardDocument,
  isCardCollectionDocument,
  type CardDocument,
  type SingleCardDocument,
  type LooseSingleCardDocument,
} from '@cardstack/runtime-common';
import type { Query } from '@cardstack/runtime-common/query';
import { importResource } from '../resources/import';
import type {
  Card,
  CardBase,
  Field,
  SerializeOpts,
} from 'https://cardstack.com/base/card-api';
import type * as CardAPI from 'https://cardstack.com/base/card-api';
import ENV from '@cardstack/host/config/environment';

const { ownRealmURL } = ENV;

export default class CardService extends Service {
  @service declare loaderService: LoaderService;

  private apiModule = importResource(
    this,
    () => 'https://cardstack.com/base/card-api'
  );

  private get api() {
    if (this.apiModule.error) {
      throw new Error(
        `Error loading Card API: ${JSON.stringify(this.apiModule.error)}`
      );
    }
    if (!this.apiModule.module) {
      throw new Error(
        `bug: Card API has not loaded yet--make sure to await this.loaded before using the api`
      );
    }
    return this.apiModule.module as typeof CardAPI;
  }

  // Note that this should be the unresolved URL and that we need to rely on our
  // fetch to do any URL resolution.
  get defaultURL(): URL {
    return new URL(ownRealmURL);
  }

  private async fetchJSON(
    url: string | URL,
    args?: RequestInit
  ): Promise<CardDocument> {
    let response = await this.loaderService.loader.fetch(url, {
      headers: { Accept: SupportedMimeType.CardJson },
      ...args,
    });
    if (!response.ok) {
      throw new Error(
        `status: ${response.status} -
        ${response.statusText}. ${await response.text()}`
      );
    }
    return await response.json();
  }

  async createFromSerialized(
    resource: LooseCardResource,
    doc: LooseSingleCardDocument | CardDocument,
    relativeTo: URL | undefined
  ): Promise<Card> {
    await this.apiModule.loaded;
    let card = await this.api.createFromSerialized(resource, doc, relativeTo, {
      loader: this.loaderService.loader,
    });
    // it's important that we absorb the field async here so that glimmer won't
    // encounter NotReady errors, since we don't have the luxury of the indexer
    // being able to inform us of which fields are used or not at this point.
    // (this is something that the card compiler could optimize for us in the
    // future)
    await this.api.recompute(card, {
      recomputeAllFields: true,
      loadFields: true,
    });
    return card as Card;
  }

  async loadModel(url: URL): Promise<Card> {
    await this.apiModule.loaded;
    let json = await this.fetchJSON(url);
    if (!isSingleCardDocument(json)) {
      throw new Error(
        `bug: server returned a non card document for ${url}:
        ${JSON.stringify(json, null, 2)}`
      );
    }
    return await this.createFromSerialized(
      json.data,
      json,
      typeof url === 'string' ? new URL(url) : url
    );
  }

  async serializeCard(
    card: Card,
    opts?: SerializeOpts
  ): Promise<LooseSingleCardDocument> {
    await this.apiModule.loaded;
    return this.api.serializeCard(card, opts);
  }

  async saveModel(card: Card): Promise<Card> {
    await this.apiModule.loaded;
    let doc = await this.serializeCard(card, {
      includeComputeds: true,
      maybeRelativeURL: null, // forces URL's to be absolute.
    });
    let isSaved = this.api.isSaved(card);
    // send doc over the wire with absolute URL's. The realm server will convert
    // to relative URL's as it serializes the cards
    let json = await this.saveCardDocument(
      doc,
      card.id ? new URL(card.id) : undefined
    );
    if (isSaved) {
      return (await this.api.updateFromSerialized(card, json)) as Card;
    }
    // for a brand new card that has no id yet, we don't know what we are
    // relativeTo because its up to the realm server to assign us an ID, so
    // URL's should be absolute
    let relativeTo = json.data.id ? new URL(json.data.id) : undefined;
    return await this.createFromSerialized(json.data, json, relativeTo);
  }

  async saveCardDocument(
    doc: LooseSingleCardDocument,
    url?: URL
  ): Promise<SingleCardDocument> {
    let isSaved = !!url;
    url = url ?? this.defaultURL;
    let json = await this.fetchJSON(url, {
      method: isSaved ? 'PATCH' : 'POST',
      body: JSON.stringify(doc, null, 2),
    });
    if (!isSingleCardDocument(json)) {
      throw new Error(
        `bug: arg is not a card document:
        ${JSON.stringify(json, null, 2)}`
      );
    }
    return json;
  }

  async search(query: Query, realmURL: URL): Promise<Card[]> {
    let json = await this.fetchJSON(`${realmURL}_search?${stringify(query)}`);
    if (!isCardCollectionDocument(json)) {
      throw new Error(
        `The realm search response was not a card collection document:
        ${JSON.stringify(json, null, 2)}`
      );
    }
    // TODO the fact that the loader cannot handle a concurrent form of this is
    // indicative of a loader issue. Need to work with Ed around this as I think
    // there is probably missing state in our loader's state machine.
    let results: Card[] = [];
    for (let doc of json.data) {
      results.push(await this.createFromSerialized(doc, json, new URL(doc.id)));
    }
    return results;
  }

  async getFields(
    card: CardBase
  ): Promise<{ [fieldName: string]: Field<typeof CardBase> }> {
    await this.apiModule.loaded;
    return this.api.getFields(card, { includeComputeds: true });
  }

  async isPrimitive(card: typeof CardBase): Promise<boolean> {
    await this.apiModule.loaded;
    return this.api.primitive in card;
  }

  async realmInfoSymbol(): Promise<Symbol> {
    await this.apiModule.loaded;
    return this.api.realmInfo;
  }
}
