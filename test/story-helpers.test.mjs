import { strict as assert } from "node:assert";
import test from "node:test";
import { DEFAULT_XP_SERVER_URL } from "../dist/preview.js";

/** `preview.js` reads `APP_NAME` when it is evaluated, so import a fresh copy for each value. */
async function importPreviewWith(appName) {
  const previous = process.env.APP_NAME;
  if (appName === undefined) delete process.env.APP_NAME;
  else process.env.APP_NAME = appName;
  try {
    return await import(`../dist/preview.js?appName=${appName}`);
  } finally {
    if (previous === undefined) delete process.env.APP_NAME;
    else process.env.APP_NAME = previous;
  }
}

test("default server: sends xpAppName when APP_NAME is set", async () => {
  const { parameters } = await importPreviewWith("com.example.myapp");
  assert.equal(parameters.server.params.xpAppName, "com.example.myapp");
});

test("default server: omits xpAppName when APP_NAME is unset", async () => {
  const { parameters } = await importPreviewWith(undefined);
  assert.equal(parameters.server.url, DEFAULT_XP_SERVER_URL);
  assert.deepEqual(parameters.server.params, {});
});
