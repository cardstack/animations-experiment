import { Memoize } from 'typescript-memoize';
import {
  Deferred,
  logger,
  type Stats,
  type DBAdapter,
  type Queue,
  type WorkerArgs,
  type FromScratchResult,
  type IncrementalArgs,
  type IncrementalResult,
} from '.';
import { IndexWriter } from './index-writer';
import { Realm } from './realm';
import { Loader } from './loader';
import ignore, { type Ignore } from 'ignore';
import { isIgnored } from './paths';

export class RealmIndexUpdater {
  #realm: Realm;
  #loader: Loader;
  #log = logger('realm-index-updater');
  #ignoreData: Record<string, string> = {};
  #stats: Stats = {
    instancesIndexed: 0,
    modulesIndexed: 0,
    instanceErrors: 0,
    moduleErrors: 0,
    totalIndexEntries: 0,
  };
  #indexWriter: IndexWriter;
  #queue: Queue;
  #indexingDeferred: Deferred<void> | undefined;

  constructor({
    realm,
    dbAdapter,
    queue,
  }: {
    realm: Realm;
    dbAdapter: DBAdapter;
    queue: Queue;
  }) {
    if (!dbAdapter) {
      throw new Error(
        `DB Adapter was not provided to SearchIndex constructor--this is required when using a db based index`,
      );
    }
    this.#indexWriter = new IndexWriter(dbAdapter);
    this.#queue = queue;
    this.#realm = realm;
    this.#loader = Loader.cloneLoader(this.#realm.loaderTemplate);
  }

  get stats() {
    return this.#stats;
  }

  get loader() {
    return this.#loader;
  }

  @Memoize()
  private get realmURL() {
    return new URL(this.#realm.url);
  }

  private get ignoreMap() {
    let ignoreMap = new Map<string, Ignore>();
    for (let [url, contents] of Object.entries(this.#ignoreData)) {
      ignoreMap.set(url, ignore().add(contents));
    }
    return ignoreMap;
  }

  async run() {
    let isNewIndex = await this.#indexWriter.isNewIndex(this.realmURL);
    if (isNewIndex) {
      // we only await the full indexing at boot if this is a brand new index
      await this.fullIndex();
    } else {
      // this promise is tracked in `this.indexing()` if consumers need it.
      this.fullIndex();
    }
  }

  indexing() {
    return this.#indexingDeferred?.promise;
  }

  // TODO consider triggering SSE events for invalidations now that we can
  // calculate fine grained invalidations for from-scratch indexing by passing
  // in an onInvalidation callback
  async fullIndex() {
    this.#indexingDeferred = new Deferred<void>();
    try {
      let args: WorkerArgs = {
        realmURL: this.#realm.url,
        realmUsername: await this.getRealmUsername(),
      };
      let job = await this.#queue.publish<FromScratchResult>(
        `from-scratch-index`,
        args,
      );
      let { ignoreData, stats } = await job.done;
      this.#stats = stats;
      this.#ignoreData = ignoreData;
      this.#loader = Loader.cloneLoader(this.#realm.loaderTemplate);
      this.#log.info(
        `Realm ${this.realmURL.href} has completed indexing: ${JSON.stringify(
          stats,
          null,
          2,
        )}`,
      );
    } catch (e: any) {
      this.#indexingDeferred.reject(e);
      throw e;
    } finally {
      this.#indexingDeferred.fulfill();
    }
  }

  async update(
    url: URL,
    opts?: { delete?: true; onInvalidation?: (invalidatedURLs: URL[]) => void },
  ): Promise<void> {
    this.#indexingDeferred = new Deferred<void>();
    try {
      let args: IncrementalArgs = {
        url: url.href,
        realmURL: this.#realm.url,
        realmUsername: await this.getRealmUsername(),
        operation: opts?.delete ? 'delete' : 'update',
        ignoreData: { ...this.#ignoreData },
      };
      let job = await this.#queue.publish<IncrementalResult>(
        `incremental-index`,
        args,
      );
      let { invalidations, ignoreData, stats } = await job.done;
      this.#stats = stats;
      this.#ignoreData = ignoreData;
      this.#loader = Loader.cloneLoader(this.#realm.loaderTemplate);
      if (opts?.onInvalidation) {
        opts.onInvalidation(
          invalidations.map((href) => new URL(href.replace(/\.json$/, ''))),
        );
      }
    } catch (e: any) {
      this.#indexingDeferred.reject(e);
      throw e;
    } finally {
      this.#indexingDeferred.fulfill();
    }
  }

  public isIgnored(url: URL): boolean {
    // TODO this may be called before search index is ready in which case we
    // should provide a default ignore list. But really we should decouple the
    // realm's consumption of this from the search index so that the realm can
    // figure out what files are ignored before indexing has happened.
    if (
      ['node_modules'].includes(url.href.replace(/\/$/, '').split('/').pop()!)
    ) {
      return true;
    }
    return isIgnored(this.realmURL, this.ignoreMap, url);
  }

  private async getRealmUsername(): Promise<string> {
    // TODO for now we are just using the URL pattern and hard coding test
    // URLs to figure out the realm username. As part of the ticket to create
    // dynamic realms this should be updated to look up the realm owner
    // permission
    switch (this.realmURL.href) {
      case 'http://127.0.0.1:4441/':
        return 'base_realm';

      case 'http://127.0.0.1:4447/':
        return 'test_realm';

      case 'http://127.0.0.1:4444/':
      case 'http://127.0.0.1:4445/':
      case 'http://127.0.0.1:4448/':
        return 'node-test_realm';

      default: {
        let name = this.realmURL.href.replace(/\/$/, '').split('/').pop()!;
        return `${name}_realm`;
      }
    }
  }
}
