// Post-build step for the type declarations.
//
// 1. Copy the hand-authored global-script `ambient-modules.d.ts` into `dist/`
//    (`tsc` type-checks input `.d.ts` files but never emits/copies them).
// 2. Prepend a triple-slash reference to it at the top of `dist/index.d.ts`.
//    `tsc` drops the reference we write in `src/index.ts` (it only emits reference
//    directives the output actually *uses*, and ours is a pure global side-effect),
//    so we re-add it here. This is what lets an XP project pick up the ambient
//    `*.ftl` / `*.html` module types via:
//      "compilerOptions": { "types": ["@itemconsulting/storybook-framework-enonic-xp"] }
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";

const REFERENCE = '/// <reference path="./ambient-modules.d.ts" />\n';
const INDEX_DTS = "dist/index.d.ts";

copyFileSync("src/ambient-modules.d.ts", "dist/ambient-modules.d.ts");

const current = readFileSync(INDEX_DTS, "utf-8");
if (!current.startsWith(REFERENCE)) {
  writeFileSync(INDEX_DTS, REFERENCE + current);
}
