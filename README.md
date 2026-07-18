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

## Testing stories with `@storybook/addon-vitest`

You can run your stories as tests with [`@storybook/addon-vitest`](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon).
Because this framework uses the `@storybook/server` renderer, **each story renders by fetching its
HTML from a running XP server** — so these are server-integration tests, not isolated component
tests, and your XP dev server must be running while they execute.

Install the test dependencies in your project:

```bash
npm i -D @storybook/addon-vitest vitest @vitest/browser-playwright playwright
npx playwright install chromium
```

The `playwright install` step downloads the browser you run the stories in — swap `chromium` for
`firefox` or `webkit` if you set a different `browser` in `defineXpStorybookProject()`.

To use the **Coverage** feature from the Storybook test panel, also install `@vitest/coverage-v8`
(matching your Vitest version):

```bash
npm i -D @vitest/coverage-v8
```

Add the addon in your *main.ts*:

```typescript
const config: StorybookConfig = {
  addons: ["@storybook/addon-vitest"],
  // ...
};
```

Create a *vitest.config.ts* using the helper this framework ships. It reuses the framework's Vite
setup (FreeMarker/Thymeleaf transform and `process.env.*` defines), configures Playwright browser
mode, and — when you pass `serverUrl` — fails fast with a clear message if the XP server is down:

```typescript
import { defineConfig } from "vitest/config";
import { defineXpStorybookProject } from "@itemconsulting/storybook-framework-enonic-xp/vitest";

// The async callback form works whether or not your project is ESM (`"type": "module"`).
export default defineConfig(async () => ({
  test: {
    projects: [
      await defineXpStorybookProject({
        configDir: ".storybook",
        serverUrl: "http://localhost:8080/webapp/no.item.storybook",
      }),
    ],
  },
}));
```

That's all that's required: `@storybook/addon-vitest` injects the story annotations automatically
(built from your *preview.ts* and this framework's server-renderer annotations). If you need extra
`beforeAll`/`beforeEach` logic, add an explicit `.storybook/vitest.setup.ts` and list it in the
project's `test.setupFiles`, importing `setProjectAnnotations` from `/vitest-setup`:

```typescript
import { beforeAll } from "vitest";
import { setProjectAnnotations } from "@itemconsulting/storybook-framework-enonic-xp/vitest-setup";
import * as preview from "./preview";

const project = setProjectAnnotations([preview]);
beforeAll(project.beforeAll);
```

> **CORS:** the stories are fetched from your XP server by a browser, so that server must send
> `Access-Control-Allow-Origin` headers that allow the Vitest origin, or the fetch will be blocked.

## Running tests

Unit tests can be run with the following command

```bash
npm test
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local development and the release process.
