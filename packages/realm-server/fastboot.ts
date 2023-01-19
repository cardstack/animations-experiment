//@ts-expect-error no types for fastboot
import FastBoot from "fastboot";
import { type FastBootInstance } from "@cardstack/runtime-common";
import {
  type IndexRunner,
  type RunnerOpts,
} from "@cardstack/runtime-common/search-index";

export function makeFastBootIndexRunner(
  distPath: string,
  getRunnerOpts: (optsId: number) => RunnerOpts
): IndexRunner {
  let fastboot = new FastBoot({
    distPath,
    resilient: false,
    buildSandboxGlobals(defaultGlobals: any) {
      return Object.assign({}, defaultGlobals, {
        URL: globalThis.URL,
        Request: globalThis.Request,
        Response: globalThis.Response,
        btoa,
        getRunnerOpts,
      });
    },
  }) as FastBootInstance;
  return async (optsId: number) => {
    await fastboot.visit(`/indexer/${optsId}`, {
      // TODO we'll need to configure this host origin as part of the hosted realm work
      request: { headers: { host: "localhost:4200" } },
    });
  };
}

function btoa(str: string | Buffer) {
  let buffer;
  if (str instanceof Buffer) {
    buffer = str;
  } else {
    buffer = Buffer.from(str.toString(), "binary");
  }
  return buffer.toString("base64");
}
