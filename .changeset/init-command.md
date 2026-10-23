---
"@itemconsulting/storybook-framework-enonic-xp": minor
---

Add an `init` command that sets up Storybook in an Enonic XP project:

```bash
npx @itemconsulting/storybook-framework-enonic-xp@latest init
```

It writes *.storybook/main.ts*, *.storybook/tsconfig.json* and *vitest.config.ts*, adds the
`storybook` and `build-storybook` scripts and the Storybook output to *.gitignore*, and installs the
dependencies (with the package manager the project's lockfile belongs to) and Chromium for the
tests. Existing files are left alone. It stops without changing anything when *gradle.properties*
has no `appName`, which the framework needs to start. `--skip-tests` leaves out the Vitest setup, and
`--skip-install` only writes the files.
