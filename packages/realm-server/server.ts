import Koa from 'koa';
import cors from '@koa/cors';
import Router from '@koa/router';
import { Memoize } from 'typescript-memoize';
import {
  Realm,
  logger,
  SupportedMimeType,
  type VirtualNetwork,
} from '@cardstack/runtime-common';
import { webStreamToText } from '@cardstack/runtime-common/stream';
import { setupCloseHandler } from './node-realm';
import {
  livenessCheck,
  healthCheck,
  httpLogging,
  httpBasicAuth,
  ecsMetadata,
  fullRequestURL,
} from './middleware';
import convertAcceptHeaderQueryParam from './middleware/convert-accept-header-qp';

import './lib/externals';
import { nodeStreamToText } from './stream';
import mime from 'mime-types';
import { extractSupportedMimeType } from '@cardstack/runtime-common/router';
import * as Sentry from '@sentry/node';

export class RealmServer {
  private log = logger('realm:requests');

  constructor(
    private realms: Realm[],
    private virtualNetwork: VirtualNetwork,
  ) {
    detectRealmCollision(realms);
    this.realms = realms;
  }

  @Memoize()
  get app() {
    let router = new Router();
    router.head('/', livenessCheck);
    router.get('/', healthCheck, this.serveIndex(), this.serveFromRealm);

    let app = new Koa<Koa.DefaultState, Koa.Context>()
      .use(httpLogging)
      .use(ecsMetadata)
      .use(
        cors({
          origin: '*',
          allowHeaders:
            'Authorization, Content-Type, If-Match, X-Requested-With, X-Boxel-Client-Request-Id, X-Boxel-Use-WIP-Index',
        }),
      )
      .use(async (ctx, next) => {
        // Disable browser cache for all data requests to the realm server. The condition captures our supported mime types but not others,
        // such as assets, which we probably want to cache.
        let mimeType = extractSupportedMimeType(
          ctx.header.accept as unknown as null | string | [string],
        );

        if (
          Object.values(SupportedMimeType).includes(
            mimeType as SupportedMimeType,
          )
        ) {
          ctx.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        }

        await next();
      })
      .use(convertAcceptHeaderQueryParam)
      .use(httpBasicAuth)
      .use(router.routes())
      .use(this.serveFromRealm);

    app.on('error', (err, ctx) => {
      Sentry.withScope((scope) => {
        scope.setSDKProcessingMetadata({ request: ctx.request });
        Sentry.captureException(err);
      });
    });

    return app;
  }

  listen(port: number) {
    let instance = this.app.listen(port);
    this.log.info(`Realm server listening on port %s\n`, port);
    return instance;
  }

  private serveIndex(): (ctxt: Koa.Context, next: Koa.Next) => Promise<void> {
    return async (ctxt: Koa.Context, next: Koa.Next) => {
      if (ctxt.header.accept?.includes('text/html') && this.realms.length > 0) {
        ctxt.type = 'html';
        ctxt.body = await this.realms[0].getIndexHTML({
          realmsServed: this.realms.map((r) => r.url),
        });
        return;
      }
      return next();
    };
  }

  private serveFromRealm = async (ctxt: Koa.Context, _next: Koa.Next) => {
    if (ctxt.request.path === '/_boom') {
      throw new Error('boom');
    }
    let reqBody: string | undefined;
    if (['POST', 'PATCH'].includes(ctxt.method)) {
      reqBody = await nodeStreamToText(ctxt.req);
    }

    let url = fullRequestURL(ctxt).href;
    let request = new Request(url, {
      method: ctxt.method,
      headers: ctxt.req.headers as { [name: string]: string },
      ...(reqBody ? { body: reqBody } : {}),
    });

    let realmResponse = await this.virtualNetwork.handle(
      request,
      (mappedRequest) => {
        // Setup this handler only after the request has been mapped because
        // the *mapped request* is the one that gets closed, not the original one
        setupCloseHandler(ctxt.res, mappedRequest);
      },
    );

    let { status, statusText, headers, body, nodeStream } = realmResponse;
    ctxt.status = status;
    ctxt.message = statusText;
    for (let [header, value] of headers.entries()) {
      ctxt.set(header, value);
    }
    if (!headers.get('content-type')) {
      let fileName = url.split('/').pop()!;
      ctxt.type = mime.lookup(fileName) || 'application/octet-stream';
    }

    if (nodeStream) {
      ctxt.body = nodeStream;
    } else if (body instanceof ReadableStream) {
      // A quirk with native fetch Response in node is that it will be clever
      // and convert strings or buffers in the response.body into web-streams
      // automatically. This is not to be confused with actual file streams
      // that the Realm is creating. The node HTTP server does not play nice
      // with web-streams, so we will read these streams back into strings and
      // then include in our node ServerResponse. Actual node file streams
      // (i.e streams that we are intentionally creating in the Realm) will
      // not be handled here--those will be taken care of above.
      ctxt.body = await webStreamToText(body);
    } else if (body != null) {
      ctxt.body = body;
    }
  };
}

function detectRealmCollision(realms: Realm[]): void {
  let collisions: string[] = [];
  let realmsURLs = realms.map(({ url }) => ({
    url,
    path: new URL(url).pathname,
  }));
  for (let realmA of realmsURLs) {
    for (let realmB of realmsURLs) {
      if (realmA.path.length > realmB.path.length) {
        if (realmA.path.startsWith(realmB.path)) {
          collisions.push(`${realmA.url} collides with ${realmB.url}`);
        }
      }
    }
  }
  if (collisions.length > 0) {
    throw new Error(
      `Cannot start realm server--realm route collisions detected: ${JSON.stringify(
        collisions,
      )}`,
    );
  }
}
