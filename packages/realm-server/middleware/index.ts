import proxy from 'koa-proxies';
import {
  Loader,
  assetsDir,
  logger as getLogger,
  type Realm,
} from '@cardstack/runtime-common';
import type Koa from 'koa';

interface ProxyOptions {
  responseHeaders?: Record<string, string>;
}

export function proxyAsset(
  from: string,
  assetsURL: URL,
  opts?: ProxyOptions
): Koa.Middleware<Koa.DefaultState, Koa.DefaultContext> {
  let filename = from.split('/').pop()!;
  return proxy(from, {
    target: assetsURL.href.replace(/$\//, ''),
    changeOrigin: true,
    rewrite: () => {
      return `/${filename}`;
    },
    events: {
      proxyRes: (_proxyRes, _req, res) => {
        for (let [key, value] of Object.entries(opts?.responseHeaders ?? {})) {
          res.setHeader(key, value);
        }
      },
    },
  });
}

export function livenessCheck(ctxt: Koa.Context, _next: Koa.Next) {
  ctxt.status = 200;
  ctxt.set('server', '@cardstack/host');
}

// Respond to AWS ELB health check
export function healthCheck(ctxt: Koa.Context, next: Koa.Next) {
  if (ctxt.req.headers['user-agent']?.startsWith('ELB-HealthChecker')) {
    ctxt.body = 'OK';
    return;
  }
  return next();
}

export function httpLogging(ctxt: Koa.Context, next: Koa.Next) {
  let logger = getLogger('realm:requests');
  ctxt.res.on('finish', () => {
    logger.info(
      `${ctxt.method} ${ctxt.req.headers.accept} ${
        fullRequestURL(ctxt).href
      }: ${ctxt.status}`
    );
    logger.debug(JSON.stringify(ctxt.req.headers));
  });
  return next();
}

export function ecsMetadata(ctxt: Koa.Context, next: Koa.Next) {
  if (process.env['ECS_CONTAINER_METADATA_URI_V4']) {
    ctxt.set(
      'X-ECS-Container-Metadata-URI-v4',
      process.env['ECS_CONTAINER_METADATA_URI_V4']
    );
  }
  return next();
}

export function assetRedirect(
  assetsURL: URL
): (ctxt: Koa.Context, next: Koa.Next) => void {
  return (ctxt: Koa.Context, next: Koa.Next) => {
    if (ctxt.path.startsWith(`/${assetsDir}`)) {
      let redirectURL = new URL(
        `./${ctxt.path.slice(assetsDir.length + 1)}`,
        assetsURL
      ).href;

      if (redirectURL !== ctxt.href) {
        ctxt.redirect(redirectURL);
        return;
      }
    }
    return next();
  };
}

// requests for the root of the realm without a trailing slash aren't
// technically inside the realm (as the realm includes the trailing '/').
// So issue a redirect in those scenarios.
export function rootRealmRedirect(
  realms: Realm[]
): (ctxt: Koa.Context, next: Koa.Next) => void {
  return (ctxt: Koa.Context, next: Koa.Next) => {
    let url = fullRequestURL(ctxt);

    let realmUrlWithoutQueryParams = url.href.split('?')[0];
    if (
      !realmUrlWithoutQueryParams.endsWith('/') &&
      realms.find(
        (r) =>
          Loader.reverseResolution(`${realmUrlWithoutQueryParams}/`).href ===
          r.url
      )
    ) {
      url.pathname = `${url.pathname}/`;
      ctxt.redirect(`${url.href}`); // Adding a trailing slash to the URL one line above will update the href
      return;
    }
    return next();
  };
}

export function fullRequestURL(ctxt: Koa.Context): URL {
  let protocol =
    ctxt.req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return new URL(`${protocol}://${ctxt.req.headers.host}${ctxt.req.url}`);
}
