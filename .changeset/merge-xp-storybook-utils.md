---
"@itemconsulting/storybook-framework-enonic-xp": minor
---

Replace `@itemconsulting/xp-storybook-utils`, and apply the default XP server settings
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
