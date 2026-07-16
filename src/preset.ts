import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "storybook/internal/node-logger";
import type { PresetProperty } from "storybook/internal/types";
import type { InlineConfig } from "vite";
import { getGradleProperty } from "./gradle-properties.js";
import { enonicXP } from "./plugins/xp-templates.js";

// `import.meta.resolve` returns an ESM-importable file URL anchored to this package,
// which is what Storybook 10 imports for the builder/renderer (a bare directory path,
// as used by the webpack frameworks, is not resolvable as an ES module).
const resolveModule = (id: string): string => import.meta.resolve(id);

/**
 * Framework wiring: the `@storybook/server` renderer paired with the Vite builder.
 * This is what makes `framework: { name: "@itemconsulting/storybook-framework-enonic-xp" }` work.
 */
export const core: PresetProperty<"core"> = {
  builder: resolveModule("@storybook/builder-vite"),
  renderer: resolveModule("@storybook/server/preset"),
};

/**
 * Inject the FreeMarker / Thymeleaf template plugin into Vite, and expose the same
 * `process.env.*` constants the old webpack `DefinePlugin` provided (read from
 * `gradle.properties` at the project root).
 */
export const viteFinal = async (config: InlineConfig): Promise<InlineConfig> => {
  const { mergeConfig } = await import("vite");

  logger.info("Enabling Freemarker template support for XP");
  logger.info("Enabling Thymeleaf template support for XP");

  const propertiesPath = resolve("gradle.properties");
  const fileContent = existsSync(propertiesPath) ? readFileSync(propertiesPath, "utf-8") : "";

  const define = {
    "process.env.RESOURCES_DIR": JSON.stringify(resolve("src/main/resources")),
    "process.env.APP_NAME": JSON.stringify(getGradleProperty("appName", fileContent) ?? ""),
  };

  return mergeConfig(config, {
    plugins: [enonicXP()],
    // `define` covers app source. Dependencies (e.g. @itemconsulting/xp-storybook-utils,
    // which reads `process.env.RESOURCES_DIR` / `process.env.APP_NAME` in the browser) are
    // pre-bundled in a separate esbuild pass that does NOT see `define`, so the same
    // constants must also be passed to the optimizer — otherwise a bare `process` reference
    // survives and throws `process is not defined` in the preview iframe.
    define,
    optimizeDeps: {
      esbuildOptions: {
        define,
      },
    },
  } satisfies InlineConfig);
};
