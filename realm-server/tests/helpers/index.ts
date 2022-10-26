import { writeFileSync, writeJSONSync } from "fs-extra";
import { NodeAdapter } from "../../node-realm";
import { join } from "path";
import {
  Realm,
  LooseSingleCardDocument,
  type CardAPI,
} from "@cardstack/runtime-common";

export const testRealm = "http://test-realm/";

export function createRealm(
  dir: string,
  flatFiles: Record<string, string | LooseSingleCardDocument>,
  realmURL = testRealm
): Realm {
  for (let [filename, contents] of Object.entries(flatFiles)) {
    if (typeof contents === "string") {
      writeFileSync(join(dir, filename), contents);
    } else {
      writeJSONSync(join(dir, filename), contents);
    }
  }
  return new Realm(realmURL, new NodeAdapter(dir));
}

export function setupCardLogs(
  hooks: NestedHooks,
  apiThunk: () => Promise<CardAPI>
) {
  hooks.afterEach(async function () {
    let api = await apiThunk();
    await api.flushLogs();
  });
}
