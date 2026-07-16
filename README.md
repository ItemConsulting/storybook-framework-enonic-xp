# Enonic XP framework for Storybook

Storybook framework for integrating with Enonic XP. It pairs the
[`@storybook/server`](https://storybook.js.org/docs/get-started/frameworks/server) renderer
(stories are rendered server-side by a running XP instance) with the **Vite** builder, and adds
support for FreeMarker (`.ftl`, `.ftlh`, `.ftlx`) and Thymeleaf (`.html`) templates.

[![npm version](https://badge.fury.io/js/@itemconsulting%2Fstorybook-framework-enonic-xp.svg)](https://badge.fury.io/js/@itemconsulting%2Fstorybook-framework-enonic-xp)

## Usage

Install the package and its peer dependencies in your project.

```bash
npm i -D @itemconsulting/storybook-framework-enonic-xp storybook vite
```

Use it as the `framework` in your *main.ts* (or *main.js*) file — it is no longer an addon:

```typescript
import type { StorybookConfig } from "@itemconsulting/storybook-framework-enonic-xp";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.ts"],
  framework: {
    name: "@itemconsulting/storybook-framework-enonic-xp",
    options: {},
  },
};

export default config;
```

## Typing template imports

In a story you import a template to get its id, which the framework resolves to the template's
path relative to `src/main/resources`:

```typescript
import id from "./header.ftlh"; // id="site/parts/header/header.ftlh"
import type { Meta } from "@itemconsulting/xp-storybook-utils";

export default {
  title: "Part/Header",
  parameters: {
    server: { 
      id
    },
  },
} satisfies Meta;
```

To make TypeScript aware of `*.ftl`, `*.ftlh`, `*.ftlx` and `*.html` imports (typed as `string`),
add this package to the `types` array under `compilerOptions` in your project's *tsconfig.json*:

```json
{
  "compilerOptions": {
    "types": ["@itemconsulting/storybook-framework-enonic-xp"]
  }
}
```

## Running tests

Unit tests can be run with the following command

```bash
npm test
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local development and the release process.
