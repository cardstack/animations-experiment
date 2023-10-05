import { getOwner } from '@ember/application';
import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import { restartableTask } from 'ember-concurrency';
import { Resource } from 'ember-resources';

import {
  identifyCard,
  internalKeyFor,
  baseRealm,
  moduleFrom,
  getAncestor,
  RealmInfo,
} from '@cardstack/runtime-common';
import { SupportedMimeType } from '@cardstack/runtime-common';
import { isCodeRef, type CodeRef } from '@cardstack/runtime-common/code-ref';
import { Loader } from '@cardstack/runtime-common/loader';

import type CardService from '@cardstack/host/services/card-service';

import type {
  BaseDef,
  Field,
  FieldType,
} from 'https://cardstack.com/base/card-api';

import type * as CardAPI from 'https://cardstack.com/base/card-api';

import type LoaderService from '../services/loader-service';

interface Args {
  named: {
    definition: typeof BaseDef;
    loader: Loader;
  };
}

export type CodeRefType = CodeRef & {
  displayName: string;
};

export interface Type {
  id: string;
  module: string;
  displayName: string;
  super: Type | undefined;
  fields: {
    name: string;
    card: Type | CodeRefType;
    type: FieldType;
  }[];
  codeRef: CodeRef;
  moduleInfo: ModuleInfo;
}

interface ModuleInfo {
  extension: string;
  realmInfo: RealmInfo;
}

const moduleInfoCache: Map<string, ModuleInfo> = new Map();

export class CardType extends Resource<Args> {
  @tracked type: Type | undefined;
  @service declare cardService: CardService;
  declare loader: Loader;
  typeCache: Map<string, Type> = new Map();
  ready: Promise<void> | undefined;

  modify(_positional: never[], named: Args['named']) {
    let { definition, loader } = named;
    this.loader = loader;
    this.ready = this.assembleType.perform(definition);
  }

  get isLoading() {
    return this.assembleType.isRunning;
  }

  private assembleType = restartableTask(async (card: typeof BaseDef) => {
    let maybeType = await this.toType(card);
    if (this.isCodeRefType(maybeType)) {
      throw new Error(`bug: should never get here`);
    }
    this.type = maybeType;
  });

  private async toType(
    card: typeof BaseDef,
    stack: (typeof BaseDef)[] = [],
  ): Promise<Type | CodeRefType> {
    let maybeRef = identifyCard(card);
    if (!maybeRef) {
      throw new Error(`cannot identify card ${card.name}`);
    }
    let ref = maybeRef;
    if (stack.includes(card)) {
      return {
        ...ref,
        displayName: card.prototype.constructor.displayName,
      };
    }
    let id = internalKeyFor(ref, undefined);
    let cached = this.typeCache.get(id);
    if (cached) {
      return cached;
    }
    let moduleIdentifier = moduleFrom(ref);
    let moduleInfo =
      moduleInfoCache.get(moduleIdentifier) ??
      (await this.fetchModuleInfo(new URL(moduleIdentifier)));

    let api = await this.loader.import<typeof CardAPI>(
      `${baseRealm.url}card-api`,
    );
    let { id: _remove, ...fields } = api.getFields(card);
    let superCard = getAncestor(card);
    let superType: Type | CodeRefType | undefined;
    if (superCard && card !== superCard) {
      superType = await this.toType(superCard, [card, ...stack]);
    }
    if (this.isCodeRefType(superType)) {
      throw new Error(
        `bug: encountered cycle in card ancestor: ${[
          superType,
          ...stack.map((c) => identifyCard(c)),
        ]
          .map((r) => JSON.stringify(r))
          .join()}`,
      );
    }
    let fieldTypes: Type['fields'] = await Promise.all(
      Object.entries(fields).map(
        async ([name, field]: [string, Field<typeof BaseDef, any>]) => ({
          name,
          type: field.fieldType,
          card: await this.toType(field.card, [card, ...stack]),
        }),
      ),
    );

    let type: Type = {
      id,
      module: moduleIdentifier,
      super: superType,
      displayName: card.prototype.constructor.displayName || 'Card',
      fields: fieldTypes,
      moduleInfo,
      codeRef: ref,
    };
    this.typeCache.set(id, type);
    return type;
  }

  private fetchModuleInfo = async (url: URL) => {
    let response = await this.loader.fetch(url, {
      headers: { Accept: SupportedMimeType.CardSource },
    });

    if (!response.ok) {
      throw new Error(
        `Could not get file ${url.href}, status ${response.status}: ${
          response.statusText
        } - ${await response.text()}`,
      );
    }
    let realmURL = response.headers.get('x-boxel-realm-url');
    if (realmURL === null) {
      throw new Error(`Could not get realm url for ${url.href}`);
    }
    let realmInfo = await this.cardService.getRealmInfoByRealmURL(
      new URL(realmURL),
    );
    let moduleInfo = {
      realmInfo,
      extension: '.' + new URL(response.url).pathname.split('.').pop() || '',
    };
    moduleInfoCache.set(url.href, moduleInfo);
    return moduleInfo;
  };

  private isCodeRefType(type: any): type is CodeRefType {
    return type && isCodeRef(type) && 'displayName' in type;
  }
}

export function getCardType(parent: object, card: () => typeof BaseDef) {
  return CardType.from(parent, () => ({
    named: {
      definition: card(),
      loader: (
        (getOwner(parent) as any).lookup(
          'service:loader-service',
        ) as LoaderService
      ).loader,
    },
  })) as CardType;
}
