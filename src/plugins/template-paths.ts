import { posix } from "node:path";

// Vite normalizes module ids to POSIX-style forward slashes on every platform, and the
// plugin normalizes its inputs the same way (`xp-templates.ts` replaces `\` with `/`
// before calling in), so all path handling here uses `posix` to stay separator-agnostic
// — most importantly on Windows.
/** Root that every XP template lives under; also the anchor for root-relative refs. */
export const RESOURCES_DIR = posix.join("src", "main", "resources");

/** Path of a template relative to `src/main/resources` — used as the server story id. */
export function getPathRelativeToResources(resourcePath: string): string {
  const srcDirIndex = resourcePath.indexOf(RESOURCES_DIR);
  return resourcePath.substring(srcDirIndex + RESOURCES_DIR.length + posix.sep.length);
}

/** Absolute path to the `src/main/resources` root that contains `resourcePath`. */
function getBaseDir(resourcePath: string): string {
  const srcDirIndex = resourcePath.indexOf(RESOURCES_DIR);
  return resourcePath.substring(0, srcDirIndex + RESOURCES_DIR.length);
}

/**
 * Turn a template reference (from a FreeMarker `[#import]`/`[#include]` or a Thymeleaf
 * `data-th-replace`) into an ESM-resolvable import specifier:
 *   - "/from/resources/root" -> "<resourcesRoot>/from/resources/root" (fs-absolute)
 *   - "relative/path"        -> "./relative/path"
 *   - "./x" / "../x"         -> unchanged
 */
function toImportSpecifier(url: string, resourcePath: string): string {
  if (url === "") return "";
  if (url.startsWith("/")) {
    // Root-relative in XP -> anchor at src/main/resources
    return posix.join(getBaseDir(resourcePath), url);
  }
  if (url.startsWith("./") || url.startsWith("../")) return url;
  return `./${url}`;
}

/**
 * Extract every template dependency referenced in `source` as an import specifier.
 * `defaultExtension` (e.g. `".html"`) is appended to specifiers that have no file
 * extension — Thymeleaf references omit it, but Vite needs it to resolve the import.
 */
export function getDependencyFilePaths(
  source: string,
  resourcePath: string,
  pathRegex: RegExp,
  defaultExtension = "",
): string[] {
  const importFilePaths: string[] = [];

  for (const match of source.matchAll(pathRegex)) {
    const specifier = toImportSpecifier(match[1].trim(), resourcePath);
    if (!specifier) continue;
    importFilePaths.push(
      defaultExtension && posix.extname(specifier) === "" ? specifier + defaultExtension : specifier,
    );
  }

  return importFilePaths;
}
