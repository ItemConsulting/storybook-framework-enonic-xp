import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { detectPackageManager, getDependencies, init } from "../dist/init.js";

/** A throwaway XP project, with whatever files `files` lists. */
function xpProject(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), "xp-storybook-init-"));
  for (const [path, content] of Object.entries({ "gradle.properties": "appName = com.example.myapp\n", ...files })) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

async function runInit(cwd, options = {}) {
  const messages = [];
  await init({ cwd, skipInstall: true, log: (message) => messages.push(message), ...options });
  return messages.join("\n");
}

const read = (dir, path) => readFileSync(join(dir, path), "utf-8");

test("writes the Storybook and Vitest config, but no preview.ts", async () => {
  const dir = xpProject({ "src/main/resources/assets/styles/main.css": "" });

  await runInit(dir);

  const main = read(dir, ".storybook/main.ts");
  assert.match(main, /name: "@itemconsulting\/storybook-framework-enonic-xp"/);
  assert.match(main, /"@storybook\/addon-vitest"/);
  assert.match(main, /staticDirs: \["\.\.\/src\/main\/resources\/assets"\]/);
  assert.match(read(dir, ".storybook/tsconfig.json"), /"@itemconsulting\/storybook-framework-enonic-xp"/);
  assert.match(read(dir, "vitest.config.ts"), /defineXpStorybookProject/);
  assert.ok(!existsSync(join(dir, ".storybook/preview.ts")));
});

test("leaves out staticDirs when the project has no assets directory", async () => {
  const dir = xpProject();
  await runInit(dir);
  assert.doesNotMatch(read(dir, ".storybook/main.ts"), /staticDirs/);
});

test("--skip-tests leaves out the Vitest addon and config", async () => {
  const dir = xpProject();
  const output = await runInit(dir, { skipTests: true });

  assert.doesNotMatch(read(dir, ".storybook/main.ts"), /addon-vitest/);
  assert.ok(!existsSync(join(dir, "vitest.config.ts")));
  assert.doesNotMatch(output, /vitest/);
});

test("adds the scripts and keeps the rest of package.json", async () => {
  const dir = xpProject({
    "package.json": JSON.stringify({ name: "my-app", scripts: { build: "tsdown", storybook: "custom" } }),
  });

  const output = await runInit(dir);

  const packageJson = JSON.parse(read(dir, "package.json"));
  assert.equal(packageJson.name, "my-app");
  assert.equal(packageJson.scripts.build, "tsdown");
  assert.equal(packageJson.scripts.storybook, "custom");
  assert.equal(packageJson.scripts["build-storybook"], "storybook build");
  assert.match(output, /Skipped the "storybook" script/);
});

test("creates a package.json when the project has none", async () => {
  const dir = xpProject();
  await runInit(dir);
  assert.equal(JSON.parse(read(dir, "package.json")).private, true);
});

test("does not overwrite existing config files", async () => {
  const dir = xpProject({ ".storybook/main.ts": "// mine\n" });
  const output = await runInit(dir);
  assert.equal(read(dir, ".storybook/main.ts"), "// mine\n");
  assert.match(output, /Skipped \.storybook\/main\.ts/);
});

test("adds the Storybook entries to .gitignore once", async () => {
  const dir = xpProject({ ".gitignore": "node_modules/" });

  await runInit(dir);
  await runInit(dir);

  const gitignore = read(dir, ".gitignore");
  assert.ok(gitignore.startsWith("node_modules/\n"));
  assert.equal(gitignore.match(/storybook-static/g).length, 1);
  assert.equal(gitignore.match(/\*storybook\.log/g).length, 1);
});

test("fails without writing anything when gradle.properties has no appName", async () => {
  const dir = xpProject({ "gradle.properties": "version = 1.0.0\n" });
  await assert.rejects(runInit(dir), /Could not read "appName"/);
  assert.ok(!existsSync(join(dir, "package.json")));
  assert.ok(!existsSync(join(dir, ".storybook")));
});

test("fails when there is a build.gradle but no gradle.properties", async () => {
  const dir = mkdtempSync(join(tmpdir(), "xp-storybook-init-"));
  writeFileSync(join(dir, "build.gradle"), "");
  await assert.rejects(runInit(dir), /Could not read "appName"/);
});

test("refuses to run outside an XP project", async () => {
  const dir = mkdtempSync(join(tmpdir(), "xp-storybook-init-"));
  await assert.rejects(runInit(dir), /does not look like an Enonic XP project/);
});

test("prints the install command for the project's package manager", async () => {
  const dir = xpProject({ "pnpm-lock.yaml": "" });
  assert.equal(detectPackageManager(dir), "pnpm");
  assert.match(await runInit(dir), /pnpm add -D @itemconsulting\/storybook-framework-enonic-xp@\^/);
});

test("installs the versions the framework is tested with", () => {
  const own = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
  const dependencies = getDependencies();

  assert.ok(dependencies.includes(`@itemconsulting/storybook-framework-enonic-xp@^${own.version}`));
  assert.ok(dependencies.includes(`storybook@${own.devDependencies.storybook}`));
  assert.ok(dependencies.includes(`vitest@${own.devDependencies.vitest}`));
  assert.ok(dependencies.every((dependency) => !dependency.endsWith("@undefined")));
  assert.ok(getDependencies(true).every((dependency) => !/vitest|playwright/.test(dependency)));
});
