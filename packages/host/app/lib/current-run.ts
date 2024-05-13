import ignore, { type Ignore } from 'ignore';

import flatMap from 'lodash/flatMap';
import isEqual from 'lodash/isEqual';
import merge from 'lodash/merge';

import {
  Loader,
  baseRealm,
  logger,
  baseCardRef,
  LooseCardResource,
  isCardResource,
  internalKeyFor,
  trimExecutableExtension,
  hasExecutableExtension,
  SupportedMimeType,
  Indexer,
  Batch,
  type CodeRef,
  type RealmInfo,
} from '@cardstack/runtime-common';
import {
  type SingleCardDocument,
  type Relationship,
} from '@cardstack/runtime-common/card-document';
import {
  loadCard,
  identifyCard,
  isBaseDef,
  moduleFrom,
} from '@cardstack/runtime-common/code-ref';
import { Deferred } from '@cardstack/runtime-common/deferred';
import {
  CardError,
  isCardError,
  serializableError,
  type SerializedError,
} from '@cardstack/runtime-common/error';
import { RealmPaths, LocalPath } from '@cardstack/runtime-common/paths';
import {
  isIgnored,
  type Reader,
  type EntrySetter,
  type RunState,
  type Stats,
  type Module,
  type SearchEntryWithErrors,
  type ModuleWithErrors,
} from '@cardstack/runtime-common/search-index';
import { URLMap } from '@cardstack/runtime-common/url-map';

import {
  CardDef,
  type IdentityContext as IdentityContextType,
  LoaderType,
} from 'https://cardstack.com/base/card-api';
import type * as CardAPI from 'https://cardstack.com/base/card-api';

import { type RenderCard } from '../services/render-service';

const log = logger('current-run');

type TypesWithErrors =
  | { type: 'types'; types: string[] }
  | { type: 'error'; error: SerializedError };

export class CurrentRun {
  #invalidations: string[] = [];
  #instances: URLMap<SearchEntryWithErrors>;
  #modules = new Map<string, ModuleWithErrors>();
  #moduleWorkingCache = new Map<string, Promise<Module>>();
  #typesCache = new WeakMap<typeof CardDef, Promise<TypesWithErrors>>();
  #indexingInstances = new Map<string, Promise<void>>();
  #reader: Reader;
  // TODO make this required after feature flag removed
  #indexer: Indexer | undefined;
  // TODO make this required after feature flag removed
  #batch: Batch | undefined;
  #realmPaths: RealmPaths;
  #ignoreMap: URLMap<Ignore>;
  #ignoreData: Record<string, string>;
  #loader: Loader;
  #entrySetter: EntrySetter;
  #renderCard: RenderCard;
  #realmURL: URL;
  #realmInfo?: RealmInfo;
  #isIndexing = false;
  readonly stats: Stats = {
    instancesIndexed: 0,
    instanceErrors: 0,
    moduleErrors: 0,
  };

  constructor({
    realmURL,
    reader,
    indexer,
    instances = new URLMap(),
    modules = new Map(),
    ignoreMap = new URLMap(),
    ignoreData = new Object(null) as Record<string, string>,
    loader,
    entrySetter,
    renderCard,
  }: {
    realmURL: URL;
    reader: Reader;
    indexer?: Indexer;
    instances?: URLMap<SearchEntryWithErrors>;
    modules?: Map<string, ModuleWithErrors>;
    ignoreMap?: URLMap<Ignore>;
    ignoreData?: Record<string, string>;
    loader: Loader;
    entrySetter: EntrySetter;
    renderCard: RenderCard;
  }) {
    this.#indexer = indexer;
    this.#realmPaths = new RealmPaths(realmURL);
    this.#reader = reader;
    this.#realmURL = realmURL;
    this.#instances = instances;
    this.#modules = modules;
    this.#ignoreMap = ignoreMap;
    this.#ignoreData = ignoreData;
    this.#loader = loader;
    this.#entrySetter = entrySetter;
    this.#renderCard = renderCard;

    this.loader.prependURLHandlers([
      async (req) => {
        if (this.#isIndexing) {
          req.headers.set('X-Boxel-Use-WIP-Index', 'true');
        }
        return null;
      },
    ]);
  }

  static async fromScratch(current: CurrentRun) {
    await current.whileIndexing(async () => {
      let start = Date.now();
      log.debug(`starting from scratch indexing`);
      (globalThis as any).__currentRunLoader = current.loader;
      if (isDbIndexerEnabled()) {
        current.#batch = await current.indexer.createBatch(current.realmURL);
        current.#invalidations = [];
        await current.batch.makeNewGeneration();
      }
      await current.visitDirectory(current.realmURL);
      if (isDbIndexerEnabled()) {
        await current.batch.done();
      }
      (globalThis as any).__currentRunLoader = undefined;
      log.debug(`completed from scratch indexing in ${Date.now() - start}ms`);
    });
    return current;
  }

  static async incremental({
    url,
    operation,
    prev,
    reader,
    loader,
    entrySetter,
    renderCard,
    indexer,
    onInvalidation,
  }: {
    url: URL;
    operation: 'update' | 'delete';
    prev: RunState;
    reader: Reader;
    loader: Loader;
    entrySetter: EntrySetter;
    renderCard: RenderCard;
    indexer?: Indexer;
    // TODO remove this after we remove the feature flag. this handler happens
    // outside of the index job
    onInvalidation?: (invalidatedURLs: URL[]) => void;
  }) {
    let start = Date.now();
    log.debug(`starting from incremental indexing for ${url.href}`);
    (globalThis as any).__currentRunLoader = loader;
    let instances = new URLMap(prev.instances);
    let ignoreMap = new URLMap(prev.ignoreMap);
    let ignoreData = { ...prev.ignoreData };
    let invalidations: URL[] = [];
    let modules = new Map(prev.modules);

    if (!isDbIndexerEnabled()) {
      instances.remove(new URL(url.href.replace(/\.json$/, '')));
      invalidations = flatMap(invalidate(url, modules, instances), (u) =>
        // we only ever want to visit our own URL in the update case so we'll do
        // that explicitly
        u !== url.href && u !== trimExecutableExtension(url).href
          ? [new URL(u)]
          : [],
      );
    }

    let current = new this({
      realmURL: prev.realmURL,
      reader,
      indexer,
      instances,
      modules,
      ignoreMap,
      ignoreData,
      loader,
      entrySetter,
      renderCard,
    });
    if (isDbIndexerEnabled()) {
      current.#batch = await current.indexer.createBatch(current.realmURL);
      invalidations = (await current.batch.invalidate(url)).map(
        (href) => new URL(href),
      );
      current.#invalidations = [...invalidations].map((url) => url.href);
    }

    await current.whileIndexing(async () => {
      if (operation === 'update') {
        await current.tryToVisit(url);
      }
      for (let invalidation of invalidations) {
        await current.tryToVisit(invalidation);
      }

      if (isDbIndexerEnabled()) {
        await current.batch.done();
      }

      (globalThis as any).__currentRunLoader = undefined;
      log.debug(
        `completed incremental indexing for ${url.href} in ${
          Date.now() - start
        }ms`,
      );
      if (onInvalidation) {
        let urls = [...new Set([url, ...invalidations].map((u) => u.href))].map(
          (href) => new URL(href.replace(/\.json$/, '')),
        );
        onInvalidation(urls);
      }
    });
    return current;
  }

  private async tryToVisit(url: URL) {
    try {
      await this.visitFile(url);
    } catch (err: any) {
      if (isCardError(err) && err.status === 404) {
        log.info(`tried to visit file ${url.href}, but it no longer exists`);
      } else {
        throw err;
      }
    }
  }

  private async whileIndexing(doIndexing: () => Promise<void>) {
    this.#isIndexing = true;
    await doIndexing();
    this.#isIndexing = false;
  }

  // TODO we can get rid of this after the feature flag is removed. this is just
  // some type sugar so we don't have to check to see if the indexer exists
  // since ultimately it will be required.
  private get indexer() {
    if (!this.#indexer) {
      throw new Error(`Indexer is missing`);
    }
    return this.#indexer;
  }

  private get batch() {
    if (!this.#batch) {
      throw new Error('Batch is missing');
    }
    return this.#batch;
  }

  get instances() {
    return this.#instances;
  }

  get invalidations() {
    return [...this.#invalidations];
  }

  get modules() {
    return this.#modules;
  }

  get ignoreMap() {
    return this.#ignoreMap;
  }

  get ignoreData() {
    return this.#ignoreData;
  }

  get realmURL() {
    return this.#realmURL;
  }

  public get loader() {
    return this.#loader;
  }

  private async visitDirectory(url: URL): Promise<void> {
    let ignorePatterns = await this.#reader.readFileAsText(
      this.#realmPaths.local(new URL('.gitignore', url)),
    );
    if (ignorePatterns && ignorePatterns.content) {
      this.#ignoreMap.set(url, ignore().add(ignorePatterns.content));
      this.#ignoreData[url.href] = ignorePatterns.content;
    }

    for await (let { path: innerPath, kind } of this.#reader.readdir(
      this.#realmPaths.local(url),
    )) {
      let innerURL = this.#realmPaths.fileURL(innerPath);
      if (isIgnored(this.#realmURL, this.#ignoreMap, innerURL)) {
        continue;
      }
      if (kind === 'file') {
        await this.visitFile(innerURL, undefined);
      } else {
        let directoryURL = this.#realmPaths.directoryURL(innerPath);
        await this.visitDirectory(directoryURL);
      }
    }
  }

  private async visitFile(
    url: URL,
    identityContext?: IdentityContextType,
  ): Promise<void> {
    if (isIgnored(this.#realmURL, this.#ignoreMap, url)) {
      return;
    }
    let start = Date.now();
    log.debug(`begin visiting file ${url.href}`);
    if (
      hasExecutableExtension(url.href) ||
      // handle modules with no extension too
      !url.href.split('/').pop()!.includes('.')
    ) {
      await this.indexCardSource(url);
    } else {
      let localPath = this.#realmPaths.local(url);

      let fileRef = await this.#reader.readFileAsText(localPath, {});
      if (!fileRef) {
        let error = new CardError(`missing file ${url.href}`, { status: 404 });
        error.deps = [url.href];
        throw error;
      }
      if (!identityContext) {
        let api = await this.#loader.import<typeof CardAPI>(
          `${baseRealm.url}card-api`,
        );
        let { IdentityContext } = api;
        identityContext = new IdentityContext();
      }

      let { content, lastModified } = fileRef;
      if (url.href.endsWith('.json')) {
        let resource;

        try {
          let { data } = JSON.parse(content);
          resource = data;
        } catch (e) {
          log.warn(`unable to parse ${url.href} as card JSON`);
        }

        if (resource && isCardResource(resource)) {
          await this.indexCard(
            localPath,
            lastModified,
            resource,
            identityContext,
          );
        }
      }
    }
    log.debug(`completed visiting file ${url.href} in ${Date.now() - start}ms`);
  }

  private async indexCardSource(url: URL): Promise<void> {
    let module: Record<string, unknown>;
    try {
      module = await this.loader.import(url.href);
    } catch (err: any) {
      this.stats.moduleErrors++;
      log.warn(
        `encountered error loading module "${url.href}": ${err.message}`,
      );
      let deps = await (
        await this.loader.getConsumedModules(url.href)
      ).filter((u) => u !== url.href);
      if (isDbIndexerEnabled()) {
        await this.batch.updateEntry(new URL(url), {
          type: 'error',
          error: {
            status: 500,
            detail: `encountered error loading module "${url.href}": ${err.message}`,
            additionalErrors: null,
            deps,
          },
        });
      }
      this.#modules.set(url.href, {
        type: 'error',
        moduleURL: url.href,
        error: {
          status: 500,
          detail: `encountered error loading module "${url.href}": ${err.message}`,
          additionalErrors: null,
          deps,
        },
      });
      return;
    }

    let refs = Object.values(module)
      .filter((maybeCard) => isBaseDef(maybeCard))
      .map((card) => identifyCard(card))
      .filter(Boolean) as CodeRef[];
    for (let ref of refs) {
      if (!('type' in ref)) {
        await this.buildModule(ref.module, url);
      }
    }
  }

  private async indexCard(
    path: LocalPath,
    lastModified: number,
    resource: LooseCardResource,
    identityContext: IdentityContextType,
  ): Promise<void> {
    let fileURL = this.#realmPaths.fileURL(path).href;
    let indexingInstance = this.#indexingInstances.get(fileURL);
    if (indexingInstance) {
      return await indexingInstance;
    }
    let deferred = new Deferred<void>();
    this.#indexingInstances.set(fileURL, deferred.promise);
    let instanceURL = new URL(
      this.#realmPaths.fileURL(path).href.replace(/\.json$/, ''),
    );
    let moduleURL = new URL(
      moduleFrom(resource.meta.adoptsFrom),
      new URL(path, this.#realmURL),
    ).href;
    let typesMaybeError: TypesWithErrors | undefined;
    let uncaughtError: Error | undefined;
    let doc: SingleCardDocument | undefined;
    let searchData: Record<string, any> | undefined;
    let cardType: typeof CardDef | undefined;
    let html: string | undefined;
    try {
      let api = await this.#loader.import<typeof CardAPI>(
        `${baseRealm.url}card-api`,
      );

      if (!this.#realmInfo) {
        let realmInfoResponse = await this.#loader.fetch(
          `${this.realmURL}_info`,
          { headers: { Accept: SupportedMimeType.RealmInfo } },
        );
        this.#realmInfo = (await realmInfoResponse.json())?.data?.attributes;
      }

      let res = { ...resource, ...{ id: instanceURL.href } };
      //Realm info may be used by a card to render field values.
      //Example: catalog-etry-card
      merge(res, {
        meta: {
          realmInfo: this.#realmInfo,
          realmURL: this.realmURL,
        },
      });
      let card = await api.createFromSerialized<typeof CardDef>(
        res,
        { data: res },
        new URL(fileURL),
        this.#loader as unknown as LoaderType,
        {
          identityContext,
        },
      );
      html = await this.#renderCard({
        card,
        format: 'isolated',
        visit: this.visitFile.bind(this),
        identityContext,
        realmPath: this.#realmPaths,
      });
      cardType = Reflect.getPrototypeOf(card)?.constructor as typeof CardDef;
      let data = api.serializeCard(card, { includeComputeds: true });
      // prepare the document for index serialization
      Object.values(data.data.relationships ?? {}).forEach(
        (rel) => delete (rel as Relationship).data,
      );
      //Add again realm info and realm URL here
      //since we won't get it from serializeCard.
      doc = merge(data, {
        data: {
          id: instanceURL.href,
          meta: {
            lastModified: lastModified,
            realmInfo: this.#realmInfo,
            realmURL: this.realmURL.href,
          },
        },
      }) as SingleCardDocument;
      searchData = await api.searchDoc(card);

      if (!searchData) {
        throw new Error(
          `bug: could not derive search doc for instance ${instanceURL.href}`,
        );
      }

      // Add a "pseudo field" to the search doc for the card type. We use the
      // "_" prefix to make a decent attempt to not pollute the userland
      // namespace for cards
      if (cardType.displayName === 'Card') {
        searchData._cardType = cardType.name;
      } else {
        searchData._cardType = cardType.displayName;
      }
    } catch (err: any) {
      uncaughtError = err;
    }
    // if we already encountered an uncaught error then no need to deal with this
    if (!uncaughtError && cardType) {
      typesMaybeError = await this.getTypes(cardType);
    }
    if (searchData && doc && typesMaybeError?.type === 'types') {
      await this.setInstance(instanceURL, {
        type: 'entry',
        entry: {
          resource: doc.data,
          searchData,
          html,
          types: typesMaybeError.types,
          deps: new Set(await this.loader.getConsumedModules(moduleURL)),
        },
      });
    } else if (uncaughtError || typesMaybeError?.type === 'error') {
      let error: SearchEntryWithErrors;
      if (uncaughtError) {
        error = {
          type: 'error',
          error:
            uncaughtError instanceof CardError
              ? serializableError(uncaughtError)
              : { detail: `${uncaughtError.message}` },
        };
        error.error.deps = [
          moduleURL,
          ...(uncaughtError instanceof CardError
            ? uncaughtError.deps ?? []
            : []),
        ];
      } else if (typesMaybeError?.type === 'error') {
        error = { type: 'error', error: typesMaybeError.error };
      } else {
        let err = new Error(`bug: should never get here`);
        deferred.reject(err);
        throw err;
      }
      log.warn(
        `encountered error indexing card instance ${path}: ${error.error.detail}`,
      );
      await this.setInstance(instanceURL, error);
    }
    deferred.fulfill();
  }

  private async setInstance(instanceURL: URL, entry: SearchEntryWithErrors) {
    if (isDbIndexerEnabled()) {
      await this.batch.updateEntry(assertURLEndsWithJSON(instanceURL), entry);
    } else {
      this.#instances.set(instanceURL, entry);
      this.#entrySetter(instanceURL, entry);
    }
    if (entry.type === 'entry') {
      this.stats.instancesIndexed++;
    } else {
      this.stats.instanceErrors++;
    }
  }

  public async buildModule(
    moduleIdentifier: string,
    relativeTo = this.#realmURL,
  ): Promise<void> {
    let url = new URL(moduleIdentifier, relativeTo).href;
    let existing = this.#modules.get(url);
    if (existing?.type === 'error') {
      throw new Error(
        `bug: card definition has errors which should never happen since the card already executed successfully: ${url}`,
      );
    }
    if (existing) {
      return;
    }

    let working = this.#moduleWorkingCache.get(url);
    if (working) {
      await working;
      return;
    }

    let deferred = new Deferred<Module>();
    this.#moduleWorkingCache.set(url, deferred.promise);
    let m = await this.#loader.import<Record<string, any>>(moduleIdentifier);
    if (m) {
      for (let exportName of Object.keys(m)) {
        m[exportName];
      }
    }
    let consumes = (await this.loader.getConsumedModules(url)).filter(
      (u) => u !== url,
    );
    let module: Module = {
      url,
      consumes,
    };
    if (isDbIndexerEnabled()) {
      await this.batch.updateEntry(new URL(url), {
        type: 'module',
        module: {
          deps: new Set(
            consumes.map((d) => trimExecutableExtension(new URL(d)).href),
          ),
        },
      });
    }
    this.#modules.set(url, { type: 'module', module });
    deferred.fulfill(module);
  }

  private async getTypes(card: typeof CardDef): Promise<TypesWithErrors> {
    let cached = this.#typesCache.get(card);
    if (cached) {
      return await cached;
    }
    let ref = identifyCard(card);
    if (!ref) {
      throw new Error(`could not identify card ${card.name}`);
    }
    let deferred = new Deferred<TypesWithErrors>();
    this.#typesCache.set(card, deferred.promise);
    let types: string[] = [];
    let fullRef: CodeRef = ref;
    while (fullRef) {
      let loadedCard, loadedCardRef;
      try {
        loadedCard = await loadCard(fullRef, { loader: this.loader });
        loadedCardRef = identifyCard(loadedCard);
        if (!loadedCardRef) {
          throw new Error(`could not identify card ${loadedCard.name}`);
        }
      } catch (error) {
        return { type: 'error', error: serializableError(error) };
      }

      types.push(internalKeyFor(loadedCardRef, undefined));
      if (!isEqual(loadedCardRef, baseCardRef)) {
        fullRef = {
          type: 'ancestorOf',
          card: loadedCardRef,
        };
      } else {
        break;
      }
    }
    let result: TypesWithErrors = { type: 'types', types };
    deferred.fulfill(result);
    return result;
  }
}

function invalidate(
  url: URL,
  modules: Map<string, ModuleWithErrors>,
  instances: URLMap<SearchEntryWithErrors>,
  invalidations: string[] = [],
  visited: Set<string> = new Set(),
): string[] {
  if (visited.has(url.href)) {
    return [];
  }

  let invalidationSet = new Set(invalidations);
  // invalidate any instances whose deps come from the URL or whose error depends on the URL
  let invalidatedInstances = [...instances]
    .filter(([instanceURL, item]) => {
      if (item.type === 'error') {
        for (let errorDep of item.error.deps ?? []) {
          if (
            errorDep === url.href ||
            errorDep === trimExecutableExtension(url).href
          ) {
            instances.remove(instanceURL); // note this is a side-effect
            return true;
          }
        }
      } else {
        if (
          item.entry.deps.has(url.href) ||
          item.entry.deps.has(trimExecutableExtension(url).href)
        ) {
          instances.remove(instanceURL); // note this is a side-effect
          return true;
        }
      }
      return false;
    })
    .map(([u]) => `${u.href}.json`);
  for (let invalidation of invalidatedInstances) {
    invalidationSet.add(invalidation);
  }

  for (let [key, maybeError] of [...modules]) {
    if (maybeError.type === 'error') {
      // invalidate any errored modules that come from the URL
      let errorModule = maybeError.moduleURL;
      if (
        errorModule === url.href ||
        errorModule === trimExecutableExtension(url).href
      ) {
        modules.delete(key);
        invalidationSet.add(errorModule);
      }

      // invalidate any modules in an error state whose errorReference comes
      // from the URL
      for (let maybeDef of maybeError.error.deps ?? []) {
        if (
          maybeDef === url.href ||
          maybeDef === trimExecutableExtension(url).href
        ) {
          for (let invalidation of invalidate(
            new URL(errorModule),
            modules,
            instances,
            [...invalidationSet],
            new Set([...visited, url.href]),
          )) {
            invalidationSet.add(invalidation);
          }
          // no need to test the other error refs, we have already decided to
          // invalidate this URL
          break;
        }
      }
      continue;
    }

    let { module } = maybeError;
    // invalidate any modules that come from the URL
    if (
      module.url === url.href ||
      module.url === trimExecutableExtension(url).href
    ) {
      modules.delete(key);
      invalidationSet.add(module.url);
    }

    // invalidate any modules that consume the URL
    for (let importURL of module.consumes) {
      if (
        importURL === url.href ||
        importURL === trimExecutableExtension(url).href
      ) {
        for (let invalidation of invalidate(
          new URL(module.url),
          modules,
          instances,
          [...invalidationSet],
          new Set([...visited, url.href]),
        )) {
          invalidationSet.add(invalidation);
        }
        // no need to test the other imports, we have already decided to
        // invalidate this URL
        break;
      }
    }
  }

  return [...invalidationSet];
}

function isDbIndexerEnabled() {
  return Boolean((globalThis as any).__enablePgIndexer?.());
}

function assertURLEndsWithJSON(url: URL): URL {
  if (!url.href.endsWith('.json')) {
    return new URL(`${url}.json`);
  }
  return url;
}
