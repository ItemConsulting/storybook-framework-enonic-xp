// Global-script ambient module declarations for Enonic XP server-side templates.
//
// This framework's Vite plugin (`plugins/xp-templates.ts`) rewrites a template import
// into a module whose default export is the template's story id (a string). These
// declarations give that a matching type, so `import header from "./header.ftl"` is
// typed as `string` in an XP project.
//
// IMPORTANT: keep this file free of top-level `import`/`export` so it stays a global
// script — that is what makes the wildcard `declare module` blocks register globally
// when the package is referenced via `tsconfig` `compilerOptions.types`.

declare module "*.ftl" {
  const storyId: string;
  export default storyId;
}
declare module "*.ftlh" {
  const storyId: string;
  export default storyId;
}
declare module "*.ftlx" {
  const storyId: string;
  export default storyId;
}
declare module "*.html" {
  const storyId: string;
  export default storyId;
}
