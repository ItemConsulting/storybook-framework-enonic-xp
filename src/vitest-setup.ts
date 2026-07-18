// Optional helper for an explicit `.storybook/vitest.setup.ts`.
//
// `@storybook/addon-vitest` normally injects the project annotations for you (built from
// `preview.ts` plus this framework's server-renderer annotations), so a setup file is NOT
// required. Add one only when you want to run extra `beforeAll`/`beforeEach` logic or pass
// annotations explicitly:
//
//   // .storybook/vitest.setup.ts
//   import { beforeAll } from "vitest";
//   import { setProjectAnnotations } from "@itemconsulting/storybook-framework-enonic-xp/vitest-setup";
//   import * as preview from "./preview";
//
//   const project = setProjectAnnotations([preview]);
//   beforeAll(project.beforeAll);
//
// The setup file must live in your Storybook config dir and be listed in the project's
// `test.setupFiles`; otherwise the addon falls back to injecting annotations itself.

export { setProjectAnnotations } from "storybook/internal/preview-api";
