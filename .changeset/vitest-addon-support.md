---
"@itemconsulting/storybook-framework-enonic-xp": minor
---

Add support for `@storybook/addon-vitest`. A new `/vitest` entry point exports
`defineXpStorybookProject()`, which builds the Vitest browser-mode project — reusing the
framework's Vite setup and, when given a `serverUrl`, guarding the run by checking that the XP
server (which the `@storybook/server` renderer fetches story HTML from) is reachable. A `/vitest-setup`
entry point re-exports `setProjectAnnotations` for projects that want an explicit
`.storybook/vitest.setup.ts`.
