import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import type { TestProjectInlineConfiguration } from "vitest/config";

export type XpStorybookProjectOptions = {
  /**
   * Storybook config directory, relative to the Vitest config file.
   *
   * @default ".storybook"
   */
  configDir?: string;
  /**
   * Script that starts Storybook. When set, Vitest launches Storybook with it in watch mode.
   * See `storybookTest`'s `storybookScript`.
   */
  storybookScript?: string;
  /**
   * URL where Storybook is hosted, used to link to a story on test failures.
   *
   * @default "http://localhost:6006"
   */
  storybookUrl?: string;
  /**
   * URL of the running Enonic XP server that renders the templates. The `@storybook/server`
   * renderer fetches each story's HTML from here, so the server must be up while the tests run.
   *
   * When provided (and `checkServer` isn't `false`), a global setup step pings it first and
   * fails with a clear message if it's unreachable — the most common cause of a failing run.
   */
  serverUrl?: string;
  /**
   * Playwright browser to run the stories in.
   *
   * @default "chromium"
   */
  browser?: "chromium" | "firefox" | "webkit";
  /**
   * Run the browser headless.
   *
   * @default true
   */
  headless?: boolean;
  /**
   * Ping `serverUrl` before the run and fail fast if the XP server is down. No effect without
   * `serverUrl`.
   *
   * @default true
   */
  checkServer?: boolean;
};

/**
 * Build the Vitest project that runs your Storybook stories through `@storybook/addon-vitest`.
 *
 * Because stories use the `@storybook/server` renderer, each one renders by fetching its HTML
 * from a running XP server (`serverUrl`) — these are server-integration tests, not isolated
 * component tests. The framework's Vite plugins (FreeMarker/Thymeleaf transform, `process.env.*`
 * defines) are applied automatically: `storybookTest` reuses this framework's `viteFinal`.
 *
 * @example
 *   // vitest.config.ts
 *   import { defineConfig } from "vitest/config";
 *   import { defineXpStorybookProject } from "@itemconsulting/storybook-framework-enonic-xp/vitest";
 *
 *   export default defineConfig({
 *     test: {
 *       projects: [
 *         await defineXpStorybookProject({
 *           serverUrl: "http://localhost:8080/webapp/no.item.storybook",
 *         }),
 *       ],
 *     },
 *   });
 */
export async function defineXpStorybookProject(
  options: XpStorybookProjectOptions = {},
): Promise<TestProjectInlineConfiguration> {
  const {
    configDir = ".storybook",
    storybookScript,
    storybookUrl,
    serverUrl,
    browser = "chromium",
    headless = true,
    checkServer = true,
  } = options;

  const globalSetup: string[] = [];
  if (serverUrl && checkServer) {
    // The guard runs in Vitest's node process, which also evaluated this config, so an env var
    // set here reaches it. It's the simplest channel — `globalSetup` entries are file paths, not
    // closures, so the URL can't be passed as an argument.
    process.env.XP_STORYBOOK_SERVER_URL = serverUrl;
    globalSetup.push(fileURLToPath(import.meta.resolve("./server-ready.js")));
  }

  // Only forward keys that are actually set. `storybookTest` fills its own defaults by spreading
  // the given options over them, so passing `storybookUrl: undefined` would clobber the default
  // `http://localhost:6006` — which drops `__STORYBOOK_URL__` from the project env and makes the
  // addon's `isStorybookProject` filter reject every story ("No test files found" in the UI).
  const storybookTestOptions: Parameters<typeof storybookTest>[0] = { configDir };
  if (storybookScript !== undefined) storybookTestOptions.storybookScript = storybookScript;
  if (storybookUrl !== undefined) storybookTestOptions.storybookUrl = storybookUrl;

  return {
    extends: true,
    plugins: [await storybookTest(storybookTestOptions)],
    test: {
      name: "storybook",
      browser: {
        enabled: true,
        headless,
        provider: playwright({}),
        instances: [{ browser }],
      },
      ...(globalSetup.length > 0 ? { globalSetup } : {}),
    },
  };
}
