import type { Plugin } from "vite";
import { getDependencyFilePaths, getPathRelativeToResources, RESOURCES_DIR } from "./template-paths.js";

// FreeMarker:  [#import "path" as x] / [#include "path"] and the angle-bracket
// equivalents <#import "path" as x> / <#include "path">.
export const FREEMARKER_IMPORT = /[[<]#(?:import|include)\s+"(.*?)".*?[\]>]/gi;
// Thymeleaf:  data-th-replace / data-th-insert / data-th-include, e.g.
//   data-th-replace="../views/header"                            (bare path)
//   data-th-replace="/site/views/breadcrumb :: breadcrumb(${x})" (path + fragment selector)
//   data-th-replace="~{../views/header}"                         (fragment-expression wrapper)
//   data-th-replace="~{/site/views/breadcrumb :: breadcrumb(${x})}"
// Capture only the path: the optional `~{ }` wrapper and a trailing `:: fragment` selector
// (and any `${...}` in it) are dropped. Unlike FreeMarker, the reference has no `.html`
// extension — it's added later.
export const THYMELEAF_REPLACE = /data-th-(?:replace|insert|include)="\s*(?:~\{\s*)?([^":{}]+?)\s*(?:[:}][^"]*)?"/gi;

const FREEMARKER_EXT = /\.ftl[hx]?$/;
const THYMELEAF_EXT = /\.html$/;

/**
 * Vite plugin that turns Enonic XP server-side templates (FreeMarker `.ftl(h|x)`
 * and Thymeleaf `.html`) into a module whose default export is the template's path
 * relative to `src/main/resources`. That path is used as `parameters.server.id`, so the
 * `@storybook/server` renderer fetches the rendered HTML from a running XP server.
 *
 * Referenced sub-templates are re-emitted as side-effect imports so Vite keeps them in
 * the module graph and triggers HMR when a dependency template changes — the ESM
 * equivalent of the `require(...)` calls the old webpack loader emitted.
 */
export function enonicXP(): Plugin {
  return {
    name: "enonic-xp:server-templates",
    // Run before Vite's core plugins so we own `.html` before its HTML handling kicks in.
    enforce: "pre",
    transform(source, id) {
      const filepath = id.split("?", 1)[0].replace(/\\/g, "/");

      // Only transform real XP templates; skip anything outside src/main/resources.
      // Scoping to it keeps the plugin away from Storybook/Vite's own `.html` files — most
      // importantly `iframe.html` and its `?html-proxy&index=N.css` sub-modules, which share
      // the `.html` extension and would otherwise be rewritten to `export default ...`,
      // breaking the preview.
      if (!filepath.includes(RESOURCES_DIR)) return null;

      const isFreemarker = FREEMARKER_EXT.test(filepath);
      const isThymeleaf = THYMELEAF_EXT.test(filepath);
      if (!isFreemarker && !isThymeleaf) return null;

      // FreeMarker references carry their own extension; Thymeleaf ones don't, so default
      // those to `.html` (the only Thymeleaf template extension) for Vite to resolve them.
      const pathRegex = isFreemarker ? FREEMARKER_IMPORT : THYMELEAF_REPLACE;
      const defaultExtension = isFreemarker ? "" : ".html";

      const imports = getDependencyFilePaths(source, filepath, pathRegex, defaultExtension)
        .map((specifier) => `import ${JSON.stringify(specifier)};`)
        .join("\n");

      const storyId = getPathRelativeToResources(filepath);

      return {
        code: `${imports}\nexport default ${JSON.stringify(storyId)};`,
        map: null,
      };
    },
  };
}
