# @itemconsulting/storybook-framework-enonic-xp

## 0.2.0

### Minor Changes

- 8be7b98: Add support for `@storybook/addon-vitest`. A new `/vitest` entry point exports
  `defineXpStorybookProject()`, which builds the Vitest browser-mode project — reusing the
  framework's Vite setup and, when given a `serverUrl`, guarding the run by checking that the XP
  server (which the `@storybook/server` renderer fetches story HTML from) is reachable. A `/vitest-setup`
  entry point re-exports `setProjectAnnotations` for projects that want an explicit
  `.storybook/vitest.setup.ts`.

## 0.1.0

### Minor Changes

- fc1be95: Initial release: a Storybook 10 framework for Enonic XP that renders FreeMarker and
  Thymeleaf templates server-side.

  - **Framework wiring** — pairs the [`@storybook/server`](https://storybook.js.org/docs/get-started/frameworks/server)
    renderer with the Vite builder, so it can be used directly as `framework` in _main.ts_
    (no longer an addon).
  - **Server-side template support** — a Vite plugin turns FreeMarker (`.ftl`, `.ftlh`,
    `.ftlx`) and Thymeleaf (`.html`) templates under `src/main/resources` into a module
    whose default export is the template's story id (its path relative to
    `src/main/resources`), which the renderer fetches from a running XP server. Referenced
    sub-templates are tracked in Vite's module graph so HMR triggers when a dependency
    template changes.
  - **XP runtime constants** — injects `process.env.RESOURCES_DIR` and
    `process.env.APP_NAME` (read from `gradle.properties`) into both the app bundle and the
    dependency optimizer, so browser-side dependencies see them too.
  - **Template import types** — ships ambient declarations for `*.ftl`, `*.ftlh`, `*.ftlx`
    and `*.html` imports (typed as `string`), enabled by adding the package to
    `compilerOptions.types` in _tsconfig.json_.
  - **Typed configuration** — exports `StorybookConfig` and `FrameworkOptions`, and
    re-exports the `@storybook/server` story helpers.
