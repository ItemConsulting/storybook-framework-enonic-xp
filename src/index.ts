/// <reference path="./ambient-modules.d.ts" />
// Pulls in ambient `*.ftl` / `*.html` module declarations (see `ambient-modules.d.ts`).
// `tsc` strips this reference from the emitted `dist/index.d.ts` (the output doesn't use
// a symbol from it), so `scripts/finalize-dts.mjs` re-adds it after the build. That is
// what lets an XP project enable the template types with just:
//   "compilerOptions": { "types": ["@itemconsulting/storybook-framework-enonic-xp"] }

// Re-export the server renderer's story helpers (Meta, StoryObj, Preview, ...).
export * from "@storybook/server";

// Public framework configuration types (`StorybookConfig`, `FrameworkOptions`).
export type * from "./types.js";
