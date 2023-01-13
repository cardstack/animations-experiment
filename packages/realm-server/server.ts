import http, { IncomingMessage, ServerResponse } from "http";
import { Realm, externalsMap } from "@cardstack/runtime-common";
import { webStreamToText } from "@cardstack/runtime-common/stream";
import { LocalPath } from "@cardstack/runtime-common/paths";
import { Readable } from "stream";
import "@cardstack/runtime-common/externals-global";

const externalsPath = "/externals/";

export interface RealmConfig {
  realmURL: string;
  path: string;
}

export function createRealmServer(realms: Realm[]) {
  detectRealmCollision(realms);

  let server = http.createServer(async (req, res) => {
    let isStreaming = false;
    try {
      if (handleCors(req, res)) {
        return;
      }
      if (!req.url) {
        throw new Error(`bug: missing URL in request`);
      }

      if (req.url.startsWith(externalsPath)) {
        handleExternals(req, res);
        return;
      }

      let realm = realms.find((r) =>
        req.url!.startsWith(new URL(r.url).pathname)
      );

      if (!realm) {
        res.statusCode = 404;
        res.statusMessage = "Not Found";
        res.end();
        return;
      }

      // despite the name, req.url is actually the pathname for the request URL
      let local: LocalPath = req.url === "/" ? "" : req.url;
      let url =
        local.endsWith("/") || local === ""
          ? realm.paths.directoryURL(local)
          : realm.paths.fileURL(local);

      let reqBody = await nodeStreamToText(req);
      let request = new Request(url.href, {
        method: req.method,
        headers: req.headers as { [name: string]: string },
        ...(reqBody ? { body: reqBody } : {}),
      });
      let { status, statusText, headers, body, nodeStream } =
        await realm.handle(request, new Response());
      res.statusCode = status;
      res.statusMessage = statusText;
      for (let [header, value] of headers.entries()) {
        res.setHeader(header, value);
      }

      if (nodeStream) {
        isStreaming = true;
        nodeStream.pipe(res);
      } else if (body instanceof ReadableStream) {
        // A quirk with native fetch Response in node is that it will be clever
        // and convert strings or buffers in the response.body into web-streams
        // automatically. This is not to be confused with actual file streams
        // that the Realm is creating. The node HTTP server does not play nice
        // with web-streams, so we will read these streams back into strings and
        // then include in our node ServerResponse. Actual node file streams
        // (i.e streams that we are intentionally creating in the Realm) will
        // not be handled here--those will be taken care of above.
        res.write(await webStreamToText(body));
      } else if (body != null) {
        res.write(body);
      }
    } finally {
      // the node pipe takes care of ending the response for us, so we only have
      // to do this when we are not piping
      if (!isStreaming) {
        res.end();
      }
    }
  });
  return server;
}

function handleCors(req: IncomingMessage, res: ServerResponse): boolean {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (
    req.method === "OPTIONS" &&
    req.headers["access-control-request-method"]
  ) {
    // preflight request
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,DELETE,PATCH");
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

function handleExternals(req: IncomingMessage, res: ServerResponse): void {
  let moduleName = req.url!.slice(externalsPath.length);
  let names = externalsMap.get(moduleName);
  if (!names) {
    res.statusCode = 404;
    res.statusMessage = `external module ${moduleName} not found.`;
    res.end();
    return;
  }

  let src = [
    `const m = globalThis.RUNTIME_SPIKE_EXTERNALS.get('${moduleName}');`,
  ];

  for (let name of names) {
    if (name === "default") {
      src.push(`export default m.default;`);
    } else {
      src.push(`export const ${name} = m.${name};`);
    }
  }
  res.statusCode = 200;
  res.setHeader("content-type", "text/javascript");
  res.write(src.join("\n"));
  res.end();
}

async function nodeStreamToText(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  // the types for Readable have not caught up to the fact these are async generators
  for await (const chunk of stream as any) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
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
        collisions
      )}`
    );
  }
}
