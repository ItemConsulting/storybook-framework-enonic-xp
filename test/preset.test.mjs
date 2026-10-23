import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { previewAnnotations, viteFinal } from "../dist/preset.js";

test("adds the framework's preview annotations after the renderer's, so its renderToCanvas wins", () => {
  const rendererEntry = "/node_modules/@storybook/server/dist/entry-preview.js";
  const entries = previewAnnotations([rendererEntry]);

  assert.equal(entries.length, 2);
  assert.equal(entries[0], rendererEntry);
  assert.match(entries[1], /[\\/]dist[\\/]preview\.js$/);
});

/** `viteFinal` reads gradle.properties relative to the working directory, which is the project root. */
function inDirectory(setUp) {
  const dir = mkdtempSync(join(tmpdir(), "xp-storybook-framework-"));
  setUp(dir);
  return dir;
}

async function withCwd(dir, fn) {
  const previous = process.cwd();
  process.chdir(dir);
  try {
    return await fn();
  } finally {
    process.chdir(previous);
  }
}

test("passes the application name through to the preview", async () => {
  const dir = inDirectory((d) => writeFileSync(join(d, "gradle.properties"), "appName = com.example.myapp\n"));

  const config = await withCwd(dir, () => viteFinal({}));

  assert.equal(config.define["process.env.APP_NAME"], JSON.stringify("com.example.myapp"));
});

// Vite 8 warns about `optimizeDeps.esbuildOptions` on every start. The devDependency is Vite 8.
test("passes the application name to the Rolldown dependency optimizer, not esbuild", async () => {
  const dir = inDirectory((d) => writeFileSync(join(d, "gradle.properties"), "appName = com.example.myapp\n"));

  const config = await withCwd(dir, () => viteFinal({}));

  assert.equal(
    config.optimizeDeps.rolldownOptions.transform.define["process.env.APP_NAME"],
    JSON.stringify("com.example.myapp"),
  );
  assert.equal(config.optimizeDeps.esbuildOptions, undefined);
});

// The server needs an application to resolve templates from, so failing here names the cause once,
// rather than letting every story fail with a 400.
test("fails when gradle.properties has no appName", async () => {
  const dir = inDirectory((d) => writeFileSync(join(d, "gradle.properties"), "version = 1.0.0\n"));

  await assert.rejects(() => withCwd(dir, () => viteFinal({})), /appName/);
});

test("fails when there is no gradle.properties at all", async () => {
  const dir = inDirectory(() => undefined);

  await assert.rejects(() => withCwd(dir, () => viteFinal({})), /appName/);
});
