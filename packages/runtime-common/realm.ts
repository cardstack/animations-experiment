import { Deferred } from './deferred';
import {
  SearchIndex,
  type IndexRunner,
  type RunnerOptionsManager,
} from './search-index';
import { type SingleCardDocument } from './card-document';
import { Loader, type MaybeLocalRequest } from './loader';
import { RealmPaths, LocalPath, join } from './paths';
import {
  systemError,
  notFound,
  methodNotAllowed,
  badRequest,
  CardError,
} from './error';
import { formatRFC7231 } from 'date-fns';
import { md5 } from 'super-fast-md5';
import {
  isCardResource,
  executableExtensions,
  hasExecutableExtension,
  isNode,
  isSingleCardDocument,
  baseRealm,
  assetsDir,
  logger,
  type CardRef,
  type LooseSingleCardDocument,
  type ResourceObjectWithId,
  type DirectoryEntryRelationship,
} from './index';
import merge from 'lodash/merge';
import flatMap from 'lodash/flatMap';
import mergeWith from 'lodash/mergeWith';
import cloneDeep from 'lodash/cloneDeep';
import {
  fileContentToText,
  readFileAsText,
  getFileWithFallbacks,
  writeToStream,
  waitForClose,
} from './stream';
import { preprocessEmbeddedTemplates } from '@cardstack/ember-template-imports/lib/preprocess-embedded-templates';
import * as babel from '@babel/core';
//@ts-ignore type import requires a newer Typescript with node16 moduleResolution
import makeEmberTemplatePlugin from 'babel-plugin-ember-template-compilation/browser';
import type { Options as EmberTemplatePluginOptions } from 'babel-plugin-ember-template-compilation/src/plugin';
import type { EmberTemplateCompiler } from 'babel-plugin-ember-template-compilation/src/ember-template-compiler';
//@ts-ignore no types are available
import * as etc from 'ember-source/dist/ember-template-compiler';
import { loaderPlugin } from './loader-plugin';
//@ts-ignore no types are available
import glimmerTemplatePlugin from '@cardstack/ember-template-imports/src/babel-plugin';
//@ts-ignore no types are available
import decoratorsProposalPlugin from '@babel/plugin-proposal-decorators';
//@ts-ignore no types are available
import classPropertiesProposalPlugin from '@babel/plugin-proposal-class-properties';
//@ts-ignore ironically no types are available
import typescriptPlugin from '@babel/plugin-transform-typescript';
//@ts-ignore no types are available
import emberConcurrencyAsyncPlugin from 'ember-concurrency-async-plugin';
import { Router, SupportedMimeType } from './router';
import { parseQueryString } from './query';
//@ts-ignore service worker can't handle this
import type { Readable } from 'stream';
import { CardBase } from 'https://cardstack.com/base/card-api';
import type * as CardAPI from 'https://cardstack.com/base/card-api';
import type { LoaderType } from 'https://cardstack.com/base/card-api';
import { createResponse } from './create-response';
import { mergeRelationships } from './merge-relationships';
import scopedCSSTransform from 'glimmer-scoped-css/ast-transform';
import type scopedCSSTransformType from 'glimmer-scoped-css/src/ast-transform';

export interface FileRef {
  path: LocalPath;
  content: ReadableStream<Uint8Array> | Readable | Uint8Array | string;
  lastModified: number;
}

export interface ResponseWithNodeStream extends Response {
  nodeStream?: Readable;
}

export interface RealmAdapter {
  readdir(
    path: LocalPath,
    opts?: {
      create?: true;
    }
  ): AsyncGenerator<{ name: string; path: LocalPath; kind: Kind }, void>;

  openFile(path: LocalPath): Promise<FileRef | undefined>;

  exists(path: LocalPath): Promise<boolean>;

  write(path: LocalPath, contents: string): Promise<{ lastModified: number }>;

  remove(path: LocalPath): Promise<void>;

  createStreamingResponse(
    req: Request,
    init: ResponseInit,
    cleanup: () => void
  ): {
    response: Response;
    writable: WritableStream;
  };

  subscribe(cb: (message: Record<string, any>) => void): Promise<void>;

  unsubscribe(): void;
}

interface Options {
  deferStartUp?: true;
  useTestingDomain?: true;
}

interface IndexHTMLOptions {
  realmsServed?: string[];
}

export class Realm {
  #startedUp = new Deferred<void>();
  #searchIndex: SearchIndex;
  #adapter: RealmAdapter;
  #router: Router;
  #deferStartup: boolean;
  #useTestingDomain = false;
  #transpileCache = new Map<string, string>();
  #log = logger('realm');
  #getIndexHTML: () => Promise<string>;
  readonly paths: RealmPaths;

  get url(): string {
    return this.paths.url;
  }

  constructor(
    url: string,
    adapter: RealmAdapter,
    indexRunner: IndexRunner,
    runnerOptsMgr: RunnerOptionsManager,
    getIndexHTML: () => Promise<string>,
    opts?: Options
  ) {
    this.paths = new RealmPaths(url);
    this.#getIndexHTML = getIndexHTML;
    this.#useTestingDomain = Boolean(opts?.useTestingDomain);
    Loader.registerURLHandler(new URL(url), this.handle.bind(this));
    this.#adapter = adapter;
    this.#searchIndex = new SearchIndex(
      this,
      this.#adapter.readdir.bind(this.#adapter),
      this.readFileAsText.bind(this),
      indexRunner,
      runnerOptsMgr
    );

    this.#router = new Router(new URL(url))
      .post('/', SupportedMimeType.CardJson, this.createCard.bind(this))
      .patch(
        '/.+(?<!.json)',
        SupportedMimeType.CardJson,
        this.patchCard.bind(this)
      )
      .get('/_info', SupportedMimeType.RealmInfo, this.realmInfo.bind(this))
      .get('/_search', SupportedMimeType.CardJson, this.search.bind(this))
      .get(
        '/|/.+(?<!.json)',
        SupportedMimeType.CardJson,
        this.getCard.bind(this)
      )
      .delete(
        '/.+(?<!.json)',
        SupportedMimeType.CardJson,
        this.removeCard.bind(this)
      )
      .post(
        `/.+(${executableExtensions.map((e) => '\\' + e).join('|')})`,
        SupportedMimeType.CardSource,
        this.upsertCardSource.bind(this)
      )
      .get(
        '/.*',
        SupportedMimeType.CardSource,
        this.getCardSourceOrRedirect.bind(this)
      )
      .delete(
        '/.+',
        SupportedMimeType.CardSource,
        this.removeCardSource.bind(this)
      )
      .get(
        '/_message',
        SupportedMimeType.EventStream,
        this.subscribe.bind(this)
      )
      .get(
        '.*/',
        SupportedMimeType.DirectoryListing,
        this.getDirectoryListing.bind(this)
      )
      .get('/.*', SupportedMimeType.HTML, this.respondWithHTML.bind(this));

    this.#deferStartup = opts?.deferStartUp ?? false;
    if (!opts?.deferStartUp) {
      this.#startedUp.fulfill((() => this.#startup())());
    }
  }

  // it's only necessary to call this when the realm is using a deferred startup
  async start() {
    if (this.#deferStartup) {
      this.#startedUp.fulfill((() => this.#startup())());
    }
    await this.ready;
  }

  async write(
    path: LocalPath,
    contents: string
  ): Promise<{ lastModified: number }> {
    let results = await this.#adapter.write(path, contents);
    await this.#searchIndex.update(this.paths.fileURL(path));

    return results;
  }

  async delete(path: LocalPath): Promise<void> {
    await this.#adapter.remove(path);
    await this.#searchIndex.update(this.paths.fileURL(path), {
      delete: true,
    });
  }

  get searchIndex() {
    return this.#searchIndex;
  }

  async #startup() {
    await Promise.resolve();
    await this.#warmUpCache();
    await this.#searchIndex.run();
  }

  // Take advantage of the fact that the base realm modules are static (for now)
  // and cache the transpiled js for all the base realm modules so that all
  // consuming realms can benefit from this work
  async #warmUpCache() {
    if (this.url !== baseRealm.url) {
      return;
    }

    let entries = await this.recursiveDirectoryEntries(new URL(this.url));
    let modules = flatMap(entries, (e) =>
      e.kind === 'file' && hasExecutableExtension(e.path) ? [e.path] : []
    );
    for (let mod of modules) {
      let handle = await this.#adapter.openFile(mod);
      if (!handle) {
        this.#log.error(
          `cannot open file ${mod} when warming up transpilation cache`
        );
        continue;
      }
      this.makeJS(await fileContentToText(handle), handle.path);
    }
  }

  get ready(): Promise<void> {
    return this.#startedUp.promise;
  }

  async handle(request: MaybeLocalRequest): Promise<ResponseWithNodeStream> {
    // local requests are allowed to query the realm as the index is being built up
    if (!request.isLocal) {
      await this.ready;
    }
    if (!this.searchIndex) {
      return systemError('search index is not available');
    }
    if (this.#router.handles(request)) {
      return this.#router.handle(request);
    } else {
      let url = new URL(request.url);
      let localPath = this.paths.local(url);
      let maybeHandle = await this.getFileWithFallbacks(localPath);

      if (!maybeHandle) {
        return notFound(request, `${request.url} not found`);
      }

      let handle = maybeHandle;

      if (
        executableExtensions.some((extension) =>
          handle.path.endsWith(extension)
        ) &&
        !localPath.startsWith(assetsDir)
      ) {
        return this.makeJS(await fileContentToText(handle), handle.path);
      } else {
        return await this.serveLocalFile(handle);
      }
    }
  }

  async getIndexHTML(opts?: IndexHTMLOptions): Promise<string> {
    let resolvedBaseRealmURL = this.#searchIndex.loader.resolve(
      baseRealm.url
    ).href;
    let indexHTML = (await this.#getIndexHTML()).replace(
      /(<meta name="@cardstack\/host\/config\/environment" content=")([^"].*)(">)/,
      (_match, g1, g2, g3) => {
        let config = JSON.parse(decodeURIComponent(g2));
        config = merge({}, config, {
          ownRealmURL: this.url,
          resolvedBaseRealmURL,
          hostsOwnAssets: !isNode,
          realmsServed: opts?.realmsServed,
        });
        return `${g1}${encodeURIComponent(JSON.stringify(config))}${g3}`;
      }
    );

    if (isNode) {
      // set the static public asset paths in index.html
      indexHTML = indexHTML.replace(/(src|href)="\//g, `$1="/${assetsDir}`);

      // This setting relaxes the document.domain (by eliminating the port) so
      // that we can do cross origin scripting in order to perform test assertions
      if (this.#useTestingDomain) {
        indexHTML = `
          ${indexHTML}
          <script>
            document.domain = 'localhost';
          </script>
        `;
      }
    }
    return indexHTML;
  }

  private async serveLocalFile(ref: FileRef): Promise<ResponseWithNodeStream> {
    if (
      ref.content instanceof ReadableStream ||
      ref.content instanceof Uint8Array ||
      typeof ref.content === 'string'
    ) {
      return createResponse(ref.content, {
        headers: {
          'last-modified': formatRFC7231(ref.lastModified),
        },
      });
    }

    if (!isNode) {
      throw new Error(`Cannot handle node stream in a non-node environment`);
    }

    // add the node stream to the response which will get special handling in the node env
    let response = createResponse(null, {
      headers: {
        'last-modified': formatRFC7231(ref.lastModified),
      },
    }) as ResponseWithNodeStream;
    response.nodeStream = ref.content;
    return response;
  }

  private async upsertCardSource(request: Request): Promise<Response> {
    let { lastModified } = await this.write(
      this.paths.local(request.url),
      await request.text()
    );
    return createResponse(null, {
      status: 204,
      headers: { 'last-modified': formatRFC7231(lastModified) },
    });
  }

  private async getCardSourceOrRedirect(
    request: Request
  ): Promise<ResponseWithNodeStream> {
    let localName = this.paths.local(request.url);
    let handle = await this.getFileWithFallbacks(localName);
    if (!handle) {
      return notFound(request, `${localName} not found`);
    }

    if (handle.path !== localName) {
      return createResponse(null, {
        status: 302,
        headers: { Location: `${new URL(this.url).pathname}${handle.path}` },
      });
    }
    return await this.serveLocalFile(handle);
  }

  private async removeCardSource(request: Request): Promise<Response> {
    let localName = this.paths.local(request.url);
    let handle = await this.getFileWithFallbacks(localName);
    if (!handle) {
      return notFound(request, `${localName} not found`);
    }
    await this.delete(handle.path);
    return createResponse(null, { status: 204 });
  }

  private transpileJS(content: string, debugFilename: string): string {
    let hash = md5(content);
    let cached = this.#transpileCache.get(hash);
    if (cached) {
      return cached;
    }
    content = preprocessEmbeddedTemplates(content, {
      relativePath: debugFilename,
      getTemplateLocals: etc._GlimmerSyntax.getTemplateLocals,
      templateTag: 'template',
      templateTagReplacement: '__GLIMMER_TEMPLATE',
      includeSourceMaps: true,
      includeTemplateTokens: true,
    }).output;

    let templateOptions: EmberTemplatePluginOptions = {
      compiler: etc as unknown as EmberTemplateCompiler,
      transforms: [scopedCSSTransform],
    };

    let src = babel.transformSync(content, {
      filename: debugFilename,
      compact: false, // this helps for readability when debugging
      plugins: [
        glimmerTemplatePlugin,
        emberConcurrencyAsyncPlugin,
        [typescriptPlugin, { allowDeclareFields: true }],
        [decoratorsProposalPlugin, { legacy: true }],
        classPropertiesProposalPlugin,
        [makeEmberTemplatePlugin, templateOptions],
        loaderPlugin,
      ],
    })?.code;
    if (!src) {
      throw new Error('bug: should never get here');
    }

    // This assumes the base realm is static. We take advantage of the static
    // nature of the base realm such that we can cache the transpiled JS, which
    // is the slowest part of module loading (and base realm modules are
    // imported a lot by all realms)
    if (this.url === baseRealm.url) {
      this.#transpileCache.set(hash, src);
    }
    return src;
  }

  private makeJS(content: string, debugFilename: string): Response {
    try {
      content = this.transpileJS(content, debugFilename);
    } catch (err: any) {
      return createResponse(err.message, {
        // using "Not Acceptable" here because no text/javascript representation
        // can be made and we're sending text/html error page instead
        status: 406,
        headers: { 'content-type': 'text/html' },
      });
    }
    return createResponse(content, {
      status: 200,
      headers: { 'content-type': 'text/javascript' },
    });
  }

  // we bother with this because typescript is picky about allowing you to use
  // explicit file extensions in your source code
  private async getFileWithFallbacks(
    path: LocalPath
  ): Promise<FileRef | undefined> {
    return getFileWithFallbacks(
      path,
      this.#adapter.openFile.bind(this.#adapter)
    );
  }

  private async createCard(request: Request): Promise<Response> {
    let body = await request.text();
    let json;
    try {
      json = JSON.parse(body);
    } catch (e) {
      return badRequest(`Request body is not valid card JSON-API`);
    }
    let { data: resource } = json;
    if (!isCardResource(resource)) {
      return badRequest(`Request body is not valid card JSON-API`);
    }

    let name: string;
    if ('name' in resource.meta.adoptsFrom) {
      // new instances are created in a folder named after the card if it has an
      // exported name
      name = resource.meta.adoptsFrom.name;
    } else {
      name = 'cards';
    }

    let dirName = `/${join(new URL(this.url).pathname, name)}/`;
    let entries = await this.directoryEntries(new URL(dirName, this.url));
    let index = 0;
    if (entries) {
      for (let { name, kind } of entries) {
        if (kind === 'directory') {
          continue;
        }
        if (!/^[\d]+\.json$/.test(name)) {
          continue;
        }
        let num = parseInt(name.replace('.json', ''));
        index = Math.max(index, num);
      }
    }
    let pathname = `${dirName}${++index}.json`;
    let fileURL = this.paths.fileURL(pathname);
    let localPath: LocalPath = this.paths.local(fileURL);
    let { lastModified } = await this.write(
      localPath,
      JSON.stringify(await this.fileSerialization(json, fileURL), null, 2)
    );
    let newURL = fileURL.href.replace(/\.json$/, '');
    let entry = await this.#searchIndex.card(new URL(newURL), {
      loadLinks: true,
    });
    if (!entry || entry?.type === 'error') {
      let err = entry
        ? CardError.fromSerializableError(entry.error)
        : undefined;
      return systemError(
        `Unable to index new card, can't find new instance in index`,
        err
      );
    }
    let doc: SingleCardDocument = merge({}, entry.doc, {
      data: {
        links: { self: newURL },
        meta: { lastModified },
      },
    });
    return createResponse(JSON.stringify(doc, null, 2), {
      status: 201,
      headers: {
        'content-type': SupportedMimeType.CardJson,
        ...lastModifiedHeader(doc),
      },
    });
  }

  private async patchCard(request: Request): Promise<Response> {
    let localPath = this.paths.local(request.url);
    if (localPath.startsWith('_')) {
      return methodNotAllowed(request);
    }

    let url = this.paths.fileURL(localPath);
    let originalMaybeError = await this.#searchIndex.card(url);
    if (!originalMaybeError) {
      return notFound(request);
    }
    if (originalMaybeError.type === 'error') {
      return systemError(
        `unable to patch card, cannot load original from index`,
        CardError.fromSerializableError(originalMaybeError.error)
      );
    }
    let { doc: original } = originalMaybeError;
    let originalClone = cloneDeep(original);
    delete originalClone.data.meta.lastModified;

    let patch = await request.json();
    if (!isSingleCardDocument(patch)) {
      return badRequest(`The request body was not a card document`);
    }
    // prevent the client from changing the card type or ID in the patch
    delete (patch as any).data.meta;
    delete (patch as any).data.type;

    let card = mergeWith(
      originalClone,
      patch,
      (_objectValue: any, sourceValue: any) => {
        // a patched array should overwrite the original array instead of merging
        // into an original array, otherwise we won't be able to remove items in
        // the original array
        return Array.isArray(sourceValue) ? sourceValue : undefined;
      }
    );

    if (card.data.relationships || patch.data.relationships) {
      let merged = mergeRelationships(
        card.data.relationships,
        patch.data.relationships
      );

      if (merged && Object.keys(merged).length !== 0) {
        card.data.relationships = merged;
      }
    }

    delete (card as any).data.id; // don't write the ID to the file
    let path: LocalPath = `${localPath}.json`;
    let { lastModified } = await this.write(
      path,
      JSON.stringify(await this.fileSerialization(card, url), null, 2)
    );
    let instanceURL = url.href.replace(/\.json$/, '');
    let entry = await this.#searchIndex.card(new URL(instanceURL), {
      loadLinks: true,
    });
    if (!entry || entry?.type === 'error') {
      return systemError(
        `Unable to index card: can't find patched instance in index`,
        entry ? CardError.fromSerializableError(entry.error) : undefined
      );
    }
    let doc: SingleCardDocument = merge({}, entry.doc, {
      data: {
        links: { self: instanceURL },
        meta: { lastModified },
      },
    });
    return createResponse(JSON.stringify(doc, null, 2), {
      headers: {
        'content-type': SupportedMimeType.CardJson,
        ...lastModifiedHeader(doc),
      },
    });
  }

  private async getCard(request: Request): Promise<Response> {
    let localPath = this.paths.local(request.url);
    if (localPath === '') {
      localPath = 'index';
    }
    let url = this.paths.fileURL(localPath);
    let maybeError = await this.#searchIndex.card(url, { loadLinks: true });
    if (!maybeError) {
      return notFound(request);
    }
    if (maybeError.type === 'error') {
      return systemError(
        `cannot return card from index: ${maybeError.error.title} - ${maybeError.error.detail}`,
        CardError.fromSerializableError(maybeError.error)
      );
    }
    let { doc: card } = maybeError;
    card.data.links = { self: url.href };
    return createResponse(JSON.stringify(card, null, 2), {
      headers: {
        'last-modified': formatRFC7231(card.data.meta.lastModified!),
        'content-type': SupportedMimeType.CardJson,
        ...lastModifiedHeader(card),
      },
    });
  }

  private async removeCard(request: Request): Promise<Response> {
    // strip off query params
    let url = new URL(new URL(request.url).pathname, request.url);
    let result = await this.#searchIndex.card(url);
    if (!result) {
      return notFound(request);
    }
    let localPath = this.paths.local(url) + '.json';
    await this.delete(localPath);
    return createResponse(null, { status: 204 });
  }

  private async directoryEntries(
    url: URL
  ): Promise<{ name: string; kind: Kind; path: LocalPath }[] | undefined> {
    if (await this.isIgnored(url)) {
      return undefined;
    }
    let path = this.paths.local(url);
    if (!(await this.#adapter.exists(path))) {
      return undefined;
    }
    let entries: { name: string; kind: Kind; path: LocalPath }[] = [];
    for await (let entry of this.#adapter.readdir(path)) {
      let innerPath = join(path, entry.name);
      let innerURL =
        entry.kind === 'directory'
          ? this.paths.directoryURL(innerPath)
          : this.paths.fileURL(innerPath);
      if (await this.isIgnored(innerURL)) {
        continue;
      }
      entries.push(entry);
    }
    return entries;
  }

  private async recursiveDirectoryEntries(
    url: URL
  ): Promise<{ name: string; kind: Kind; path: LocalPath }[]> {
    let entries = await this.directoryEntries(url);
    if (!entries) {
      return [];
    }
    let nestedEntries: { name: string; kind: Kind; path: LocalPath }[] = [];
    for (let dirEntry of entries.filter((e) => e.kind === 'directory')) {
      nestedEntries.push(
        ...(await this.recursiveDirectoryEntries(
          new URL(`${url.href}${dirEntry.name}`)
        ))
      );
    }
    return [...entries, ...nestedEntries];
  }

  private async getDirectoryListing(request: Request): Promise<Response> {
    // a LocalPath has no leading nor trailing slash
    let localPath: LocalPath = this.paths.local(request.url);
    let url = this.paths.directoryURL(localPath);
    let entries = await this.directoryEntries(url);
    if (!entries) {
      this.#log.warn(`can't find directory ${url.href}`);
      return notFound(request);
    }

    let data: ResourceObjectWithId = {
      id: url.href,
      type: 'directory',
      relationships: {},
    };

    let dir = this.paths.local(url);
    // the entries are sorted such that the parent directory always
    // appears before the children
    entries.sort((a, b) =>
      `/${join(dir, a.name)}`.localeCompare(`/${join(dir, b.name)}`)
    );
    for (let entry of entries) {
      let relationship: DirectoryEntryRelationship = {
        links: {
          related:
            entry.kind === 'directory'
              ? this.paths.directoryURL(join(dir, entry.name)).href
              : this.paths.fileURL(join(dir, entry.name)).href,
        },
        meta: {
          kind: entry.kind as 'directory' | 'file',
        },
      };

      data.relationships![
        entry.name + (entry.kind === 'directory' ? '/' : '')
      ] = relationship;
    }

    return createResponse(JSON.stringify({ data }, null, 2), {
      headers: { 'content-type': SupportedMimeType.DirectoryListing },
    });
  }

  private async readFileAsText(
    path: LocalPath,
    opts: { withFallbacks?: true } = {}
  ): Promise<{ content: string; lastModified: number } | undefined> {
    return readFileAsText(
      path,
      this.#adapter.openFile.bind(this.#adapter),
      opts
    );
  }

  private async isIgnored(url: URL): Promise<boolean> {
    return this.#searchIndex.isIgnored(url);
  }

  private async search(request: Request): Promise<Response> {
    let doc = await this.#searchIndex.search(
      parseQueryString(new URL(request.url).search.slice(1)),
      { loadLinks: true }
    );
    return createResponse(JSON.stringify(doc, null, 2), {
      headers: { 'content-type': SupportedMimeType.CardJson },
    });
  }

  private async realmInfo(_request: Request): Promise<Response> {
    let fileURL = this.paths.fileURL(`.realm.json`);
    let localPath: LocalPath = this.paths.local(fileURL);
    let realmConfig = await this.readFileAsText(localPath);
    let name = 'Unnamed Workspace';
    if (realmConfig) {
      try {
        let realmConfigJson = JSON.parse(realmConfig.content);
        if (realmConfigJson.name) {
          name = realmConfigJson.name;
        }
      } catch (e) {
        this.#log.warn(`failed to parse realm config: ${e}`);
      }
    }
    let doc = {
      data: {
        id: this.paths.url.toString(),
        type: 'realm-info',
        attributes: {
          name,
        },
      },
    };
    return createResponse(JSON.stringify(doc, null, 2), {
      headers: { 'content-type': SupportedMimeType.RealmInfo },
    });
  }

  private async fileSerialization(
    doc: LooseSingleCardDocument,
    relativeTo: URL
  ): Promise<LooseSingleCardDocument> {
    let api = await this.searchIndex.loader.import<typeof CardAPI>(
      'https://cardstack.com/base/card-api'
    );
    let card: CardBase = await api.createFromSerialized(
      doc.data,
      doc,
      relativeTo,
      {
        loader: this.searchIndex.loader as unknown as LoaderType,
      }
    );
    let data: LooseSingleCardDocument = api.serializeCard(card); // this strips out computeds
    delete data.data.id; // the ID is derived from the filename, so we don't serialize it on disk
    delete data.included;
    for (let relationship of Object.values(data.data.relationships ?? {})) {
      delete relationship.data;
    }
    return data;
  }

  private listeningClients: WritableStream[] = [];

  private async subscribe(req: Request): Promise<Response> {
    let headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    };

    let { response, writable } = this.#adapter.createStreamingResponse(
      req,
      {
        status: 200,
        headers,
      },
      () => {
        this.listeningClients = this.listeningClients.filter(
          (w) => w !== writable
        );
        this.sendUpdateMessages({
          type: 'message',
          data: { cleanup: `${this.listeningClients.length} clients` },
        });
        if (this.listeningClients.length === 0) {
          this.#adapter.unsubscribe();
        }
      }
    );

    if (this.listeningClients.length === 0) {
      await this.#adapter.subscribe((data: Record<string, any>) =>
        this.sendUpdateMessages({ type: 'update', data })
      );
    }

    this.listeningClients.push(writable);
    this.sendUpdateMessages({
      type: 'message',
      data: { count: `${this.listeningClients.length} clients` },
    });

    // TODO: We may need to store something else here to do cleanup to keep
    // tests consistent
    waitForClose(writable);

    return response;
  }

  private async sendUpdateMessages(message: {
    type: string;
    data: Record<string, any>;
    id?: string;
  }): Promise<void> {
    this.#log.info(
      `sending updates to ${this.listeningClients.length} clients`
    );
    let { type, data, id } = message;
    let chunkArr = [];
    for (let item in data) {
      chunkArr.push(`${item}: ${data[item]}`);
    }
    let chunk = sseToChunkData(type, chunkArr.join(', '), id);
    await Promise.all(
      this.listeningClients.map((client) => writeToStream(client, chunk))
    );
  }

  private async respondWithHTML() {
    return createResponse(await this.getIndexHTML(), {
      headers: { 'content-type': 'text/html' },
    });
  }
}

export type Kind = 'file' | 'directory';

function lastModifiedHeader(
  card: LooseSingleCardDocument
): {} | { 'last-modified': string } {
  return (
    card.data.meta.lastModified != null
      ? { 'last-modified': formatRFC7231(card.data.meta.lastModified) }
      : {}
  ) as {} | { 'last-modified': string };
}

export interface CardDefinitionResource {
  id: string;
  type: 'card-definition';
  attributes: {
    cardRef: CardRef;
  };
  relationships: {
    [fieldName: string]: {
      links: {
        related: string;
      };
      meta: {
        type: 'super' | 'contains' | 'containsMany';
        ref: CardRef;
      };
    };
  };
}

function sseToChunkData(type: string, data: string, id?: string): string {
  let info = [`event: ${type}`, `data: ${data}`];
  if (id) {
    info.push(`id: ${id}`);
  }
  return info.join('\n') + '\n\n';
}
