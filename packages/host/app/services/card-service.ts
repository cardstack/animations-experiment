import Service, { service } from '@ember/service';
import { stringify } from 'qs';
import type LoaderService from './loader-service';
import type LocalRealm from '../services/local-realm';
import {
  type LooseCardResource,
  isSingleCardDocument,
  isCardCollectionDocument,
  type CardDocument,
  type LooseSingleCardDocument,
} from '@cardstack/runtime-common';
import type { Query } from '@cardstack/runtime-common/query';
import { importResource } from '../resources/import';
import type { Card } from 'https://cardstack.com/base/card-api';
import type * as CardAPI from 'https://cardstack.com/base/card-api';
import ENV from '@cardstack/host/config/environment';

const { demoRealmURL } = ENV;

interface Options {
  absoluteURL?: true;
}

export default class CardService extends Service {
  @service declare loaderService: LoaderService;
  @service declare localRealm: LocalRealm;

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
    return demoRealmURL ? new URL(demoRealmURL) : this.localRealm.url;
  }

  private async fetchJSON(
    url: string | URL,
    args?: RequestInit
  ): Promise<CardDocument> {
    let response = await this.loaderService.loader.fetch(url, {
      headers: { Accept: 'application/vnd.api+json' },
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
    opts?: Options
  ): Promise<Card> {
    await this.apiModule.loaded;
    let card = await this.api.createFromSerialized(
      resource,
      doc,
      // we don't want to touch the local realm for server side rendering
      opts?.absoluteURL ? undefined : this.defaultURL,
      {
        loader: this.loaderService.loader,
      }
    );
    await this.api.recompute(card);
    return card;
  }

  async loadModel(
    url: string | URL | undefined,
    opts?: Options
  ): Promise<Card | undefined> {
    if (!url) {
      return;
    }
    await this.apiModule.loaded;
    let json = await this.fetchJSON(url);
    if (!isSingleCardDocument(json)) {
      throw new Error(
        `bug: server returned a non card document for ${url}:
        ${JSON.stringify(json, null, 2)}`
      );
    }
    return await this.createFromSerialized(json.data, json, opts);
  }

  async saveModel(card: Card): Promise<Card> {
    await this.apiModule.loaded;
    let cardJSON = this.api.serializeCard(card, { includeComputeds: true });
    let isSaved = this.api.isSaved(card);
    let json = await this.fetchJSON(isSaved ? card.id : this.defaultURL, {
      method: isSaved ? 'PATCH' : 'POST',
      body: JSON.stringify(cardJSON, null, 2),
    });
    if (!isSingleCardDocument(json)) {
      throw new Error(
        `bug: arg is not a card document:
        ${JSON.stringify(json, null, 2)}`
      );
    }
    if (isSaved) {
      return await this.api.updateFromSerialized(card, json);
    }
    return await this.createFromSerialized(json.data, json);
  }

  async search(query: Query, realmURL: URL): Promise<Card[]> {
    let json = await this.fetchJSON(`${realmURL}_search?${stringify(query)}`);
    if (!isCardCollectionDocument(json)) {
      throw new Error(
        `The realm search response was not a card collection document:
        ${JSON.stringify(json, null, 2)}`
      );
    }
    return await Promise.all(
      json.data.map(async (doc) => await this.createFromSerialized(doc, json))
    );
  }
}
