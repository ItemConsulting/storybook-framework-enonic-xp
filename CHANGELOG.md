# @itemconsulting/storybook-framework-enonic-xp

## 1.0.0-beta.0

### Major Changes

- 0e4f6d5: Require `appName` in gradle.properties, and stop sending the resources directory
  
  The Enonic XP storybook app no longer takes a directory to read templates from; it reads them out of
  an installed application instead. `appName` is therefore no longer optional — Storybook fails to
  start when it is missing, rather than letting every story fail against the server.

### Minor Changes

- 617ac9d: Make the backgrounds, viewport and accessibility addons behave as in other Storybook setups.
  
  - The globals of Storybook's own addons (`a11y`, `backgrounds`, `measureEnabled`, `outline`,
    `viewport` and `vision`) are no longer sent to XP. Those addons work in the browser. Change the
    list with `parameters.server.excludeGlobals`; the default is exported as `CLIENT_SIDE_GLOBALS`
    from `@itemconsulting/storybook-framework-enonic-xp/preview`.
  - The framework now has its own `renderToCanvas`, which does not fetch the story from XP again when
    the request would be unchanged. Picking a background or a viewport, or toggling outline or
    measure, no longer reloads the story, so it keeps its DOM state, such as text typed into a form.
    Changed args and a remount still fetch the story again.
- 3a4ec9c: `defineXpStorybookProject()` checks the XP server without being given its URL.
  
  `serverUrl` now defaults to the URL the framework renders stories from
  (`http://localhost:8080/api/no.item.storybook:preview`), so the check that fails the run early when
  the server is down is on by default, and `defineXpStorybookProject()` needs no options. Pass
  `serverUrl` only if you changed `parameters.server.url` in *preview.ts*, or `checkServer: false`
  to turn the check off.
- 7e3f254: React to error responses from the XP server instead of rendering them as the story.
  
  `@storybook/server`'s built-in `fetchStoryHtml` never checks `response.ok`, so a template that throws server-side (XP replies 500) still resolved to a string. The renderer assigned that error page to `canvasElement.innerHTML`, which meant a broken template passed as a green test under `@storybook/addon-vitest`.
  
  The framework now ships preview annotations with a `fetchStoryHtml` that handles a non-2xx response differently per context, because each wants the opposite thing from the error page:
  
  - **Test runner** — the story fails, quoting the status and the server's error message (HTML tags stripped, so FreeMarker/Thymeleaf errors are readable on one line). The query string is omitted from the reported URL, since serialized story args would otherwise bury the message.
  - **Storybook UI** — the error page is rendered in the canvas as before, so the full stack trace stays readable and scrollable, with the same summary logged via `console.error`.
  
  The two are distinguished by `__isPortableStory`, which Storybook sets on stories composed by a portable-stories runner and never sets in the preview iframe.
  
  Set `parameters.server.fetchStoryHtml` in your `preview.ts` or on a story to override it.
- 3a4ec9c: Add an `init` command that sets up Storybook in an Enonic XP project:
  
  ```bash
  npx @itemconsulting/storybook-framework-enonic-xp@latest init
  ```
  
  It writes *.storybook/main.ts*, *.storybook/tsconfig.json* and *vitest.config.ts*, adds the
  `storybook` and `build-storybook` scripts and the Storybook output to *.gitignore*, and installs the
  dependencies (with the package manager the project's lockfile belongs to) and Chromium for the
  tests. Existing files are left alone. It stops without changing anything when *gradle.properties*
  has no `appName`, which the framework needs to start. `--skip-tests` leaves out the Vitest setup, and
  `--skip-install` only writes the files.
- 617ac9d: Replace `@itemconsulting/xp-storybook-utils`, and apply the default XP server settings
  automatically.
  
  The XP-aware `StoryObj` (which turns Java dates into strings and regions into a list of components)
  is now exported from the package root, next to `Meta`, `Preview` and `StorybookConfig`. A project
  needs one package instead of two. `renderOnServer` and `hideControls` are not included: write the
  `parameters` and `argTypes` they produced directly (see the README's migration section).
  `DEFAULT_XP_SERVER` is not included either, because the framework now applies it.
  
  The framework's preview annotations now set the default `parameters.server` (`url` and
  `xpAppName`), so *.storybook/preview.ts* no longer has to. Storybook merges parameters deeply, so a
  project can still override `url` and keep the rest.
  
  The `matchers` query parameter is no longer sent, and `createPreviewServerParams` is gone with it.
  xp-storybook types model values by convention instead, from the end of their name (`Region`,
  `Date`, `Count`/`Number`); use the `javaTypes` param for anything else.
  
  Migration: replace `@itemconsulting/xp-storybook-utils` with
  `@itemconsulting/storybook-framework-enonic-xp` in your imports, remove
  `DEFAULT_XP_SERVER` and `createPreviewServerParams()` from *preview.ts*, replace any
  `renderOnServer()` and `hideControls()` calls, and uninstall `@itemconsulting/xp-storybook-utils`.

### Patch Changes

- 617ac9d: Stop Vite 8 from warning that `optimizeDeps.esbuildOptions` is deprecated.
  
  On Vite 8 the framework now passes its `define` to the dependency optimizer through
  `optimizeDeps.rolldownOptions`. Vite 5–7 still get `optimizeDeps.esbuildOptions`.
- 617ac9d: Stop sending `[object Object]` and `undefined` to the XP server.

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
