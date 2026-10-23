# Enonic XP framework for Storybook

Storybook framework for integrating with Enonic XP. It pairs the
[`@storybook/server`](https://storybook.js.org/docs/get-started/frameworks/server) renderer
(stories are rendered server-side by a running XP instance) with the **Vite** builder, and adds
support for FreeMarker (`.ftl`, `.ftlh`, `.ftlx`) and Thymeleaf (`.html`) templates.

[![npm version](https://badge.fury.io/js/@itemconsulting%2Fstorybook-framework-enonic-xp.svg)](https://badge.fury.io/js/@itemconsulting%2Fstorybook-framework-enonic-xp)

## Usage

### Set up a project

Run this in the root of your Enonic XP project:

```bash
npx @itemconsulting/storybook-framework-enonic-xp@latest init
```

It sets up the same configuration as described in the rest of this README:

- *.storybook/main.ts* with this framework and the docs, a11y, links and Vitest addons, and
  *src/main/resources/assets* as a static directory when it exists.
- *.storybook/tsconfig.json*, with the types for `*.ftl` and `*.html` imports.
- *vitest.config.ts*, to [run the stories as tests](#testing-stories-with-storybookaddon-vitest).
- The `storybook` and `build-storybook` scripts in *package.json*, and the Storybook output in
  *.gitignore*.
- The dependencies, installed with the package manager your lockfile belongs to, and Chromium for
  the tests.

It does not create a *preview.ts*, as the framework works without one. Existing files are never
overwritten. It stops without changing anything if *gradle.properties* has no `appName` (see
[Requirements](#requirements)). Pass `--skip-tests` to leave out the Vitest setup, or `--skip-install` to only write the
files and print the install command.

### Manual setup

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

### Requirements

Templates are rendered by the [xp-storybook](https://github.com/ItemConsulting/xp-storybook)
application, which reads them out of an **installed** Enonic XP application. Two things follow:

- *gradle.properties* must set `appName`. The framework reads it and tells the server which
  application to render from; Storybook refuses to start without it.
- The application has to be deployed to your sandbox, and deployed **in dev mode** if you want an
  edited template to show up without a rebuild. Use `enonic project dev`, which deploys and then
  keeps rebuilding as you work. A plain `enonic project deploy` installs the application without its
  source paths, so templates are served from the jar and edits do not appear; xp-storybook logs a
  warning when it sees this. (`-Penv=dev` cannot be passed through the CLI — see the xp-storybook
  README for the alternatives.)

| xp-storybook | this package |
| ------------ | ------------ |
| 3.x          | 1.x          |
| 2.x          | 0.2.x        |

From 1.x this package also contains the story helpers that used to be published as
`@itemconsulting/xp-storybook-utils`, so that package is no longer needed — see
[Migrating from `@itemconsulting/xp-storybook-utils`](#migrating-from-itemconsultingxp-storybook-utils).

### XP libraries

An XP library is not an application, so there is nothing for `xpAppName` to name. Point Storybook at
an application that `include`s the library, and add the library's resources to that application's
dev source paths so that edits to them are served from disk too:

```groovy
app {
  // Absolute, and added to rawDevSourcePaths so the app keeps its own source paths too.
  rawDevSourcePaths.add(file("../lib-xp-forms/src/main/resources").canonicalPath)
}
```

Then run Storybook from that application's project, with its `appName` in *gradle.properties*. Note
`rawDevSourcePaths` rather than `devSourcePaths`, and an absolute path — the
[xp-storybook README](https://github.com/ItemConsulting/xp-storybook#libraries) explains why both
matter.

## Typing template imports

In a story you import a template to get its id, which the framework resolves to the template's
path relative to `src/main/resources`:

```typescript
import id from "./header.ftlh"; // id="site/parts/header/header.ftlh"
import type { Meta } from "@itemconsulting/storybook-framework-enonic-xp";

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

## Configuring the preview

The framework already points every story at the xp-storybook app, so *.storybook/preview.ts* does
not need any `server` settings. The defaults it applies are:

- `url` — `http://localhost:8080/api/no.item.storybook:preview`.
- `params.xpAppName` — the `appName` from *gradle.properties*.

Storybook merges `parameters` deeply, so you only set what you want to change. For example, a
different server, plus date pickers for the args the server reads as dates:

```typescript
import type { Preview } from "@itemconsulting/storybook-framework-enonic-xp";

export default {
  parameters: {
    server: {
      url: "http://localhost:8081/api/no.item.storybook:preview",
    },
    controls: {
      matchers: {
        date: /Date$/,
      },
    },
  },
} satisfies Preview;
```

### Globals

Storybook's globals are sent to XP as query parameters, so a template can read a toolbar value
such as a `locale`. Globals with object values are sent as JSON, and unset ones are left out.

The globals of Storybook's own addons are not sent: `a11y`, `backgrounds`, `measureEnabled`,
`outline`, `viewport` and `vision`. Those addons work in the browser, as in any other Storybook
setup. Changing one of them also does not fetch the story from XP again, so the story keeps its
DOM state, such as text typed into a form. Changing an arg, or a global that is sent, fetches the
story again.

To change which globals are left out, set `excludeGlobals`. It replaces the default list, which is
exported as `CLIENT_SIDE_GLOBALS`:

```typescript
import type { Preview } from "@itemconsulting/storybook-framework-enonic-xp";
import { CLIENT_SIDE_GLOBALS } from "@itemconsulting/storybook-framework-enonic-xp/preview";

export default {
  parameters: {
    server: {
      // Also leave out the `theme` global from @storybook/addon-themes
      excludeGlobals: [...CLIENT_SIDE_GLOBALS, "theme"],
    },
  },
} satisfies Preview;
```

### Model value conventions

The xp-storybook app gives an arg its Java type from the end of its name, at any depth in the
model:

| Name ends in        | Value is parsed as                                                                     |
| ------------------- | -------------------------------------------------------------------------------------- |
| `Region`            | A `com.enonic.xp.region.Region`, whose components are rendered on the server            |
| `Date`              | `LocalDate`, `LocalDateTime` or `ZonedDateTime`, depending on the shape of the value  |
| `Count` or `Number` | An integer                                                                             |

The match is case-sensitive. To type an arg that doesn't follow the convention, or to opt one out,
use [`javaTypes`](#java-types). See the
[xp-storybook README](https://github.com/ItemConsulting/xp-storybook#model-value-conventions) for
the details.

> [!TIP]
> We recommend [lib-time](https://github.com/ItemConsulting/lib-xp-time) if you need to work with
> dates in Enonic XP projects.

### Expose the _api_ path in the vhost config

If you have enabled vhost routing locally through *com.enonic.xp.web.vhost.cfg*, add a mapping
that exposes the _api_ endpoint:

```ini
enabled = true

mapping.api.host = localhost
mapping.api.source = /api
mapping.api.target = /api
mapping.api.idProvider.system = default
```

## Writing stories

The types a story needs, `Meta` and `StoryObj`, are imported from the package root. Everything
else is plain `parameters.server`: `id` names the template, and each entry in `params` is sent to
the xp-storybook app as a query parameter.

We prefer to keep the *.stories.ts* files next to the XP components they preview:

<pre>
./src/main/resources/site/
├── pages/
│   └── default/
│       ├── default.ftl
│       ├── default.stories.ts
│       ├── default.ts
│       └── default.xml
└── parts/
    └── article-header/
        ├── article-header.css
        ├── article-header.ftl
        ├── article-header.stories.ts
        ├── article-header.ts
        └── article-header.xml
</pre>

> [!IMPORTANT]
> Enonic XP and Storybook are **not running in the same environment**, even though they share the
> file structure. XP controllers run in Nashorn/GraalJS on the server, and stories run in the
> browser. You cannot import a controller from a story, but both can share a type, or a module
> that has no third-party imports.

### Story for a part

```typescript
import id from "./article-header.ftl"; // 1
import type { Meta, StoryObj } from "@itemconsulting/storybook-framework-enonic-xp";
import "./article-header.css"; // 2

type FreemarkerParams = {
  displayName: string;
  intro?: string;
  publishedDate?: ZonedDateTime;
  locale: string;
};

export default {
  title: "Part/Article Header",
  parameters: {
    layout: "centered", // 3
    server: { id }, // 4
  },
} satisfies Meta<FreemarkerParams>;

export const articleHeader: StoryObj<FreemarkerParams> = { // 5
  args: {
    displayName: "This is a typical title of a blog article",
    intro: "The intro can be relevant some times.",
    publishedDate: "2023-05-23T10:41:37.212Z", // 6
    locale: "en",
  },
};
```

1. Importing the template gives its id: its path relative to *src/main/resources*.
2. Stylesheets used by the component can be imported too.
3. Storybook's layout: `"padded"` (default), `"fullscreen"` or `"centered"`.
4. `id` tells the xp-storybook app which template to render.
5. Type the story with the same model the template gets in XP — if your controller is written in
   TypeScript, it can share this type. `StoryObj` adapts it to what a story can send: Java dates
   become strings, and regions become a list of components (see below).
6. `publishedDate` ends with `Date`, so it arrives in the template as a `java.time.ZonedDateTime`
   (see [Model value conventions](#model-value-conventions)). With the `controls.matchers` from
   [Configuring the preview](#configuring-the-preview) it also gets a date picker in Storybook.

### Story for a partial template

A macro has nothing to render until it is called, so give the story an **inline template** that
imports and calls it:

```typescript
import id from "./accordion.ftl";
import type { Meta, StoryObj } from "@itemconsulting/storybook-framework-enonic-xp";
import "./accordion.css";

type FreemarkerParams = {
  id: string;
  items: {
    title: string;
    body: string;
  }[];
};

export default {
  title: "Component/Accordion",
  parameters: {
    server: {
      id, // 2
      params: {
        template: `
          [#import "/site/views/partials/accordion/accordion.ftl" as a]
          [@a.accordion id=id items=items /]
        `, // 1
      },
    },
  },
} satisfies Meta<FreemarkerParams>;

export const Accordion: StoryObj<FreemarkerParams> = {
  args: {
    id: "my-accordion",
    items: [
      { title: "First accordion", body: "This is my first test" },
      { title: "Second accordion", body: "This is my second test" },
    ],
  },
};
```

1. The inline template is rendered with the story's `args` as its model.
2. Still pass the `id`. An inline template has no file extension of its own, and the extension of
   the requested path decides whether FreeMarker or Thymeleaf renders it, so without an `id` the
   story falls back to FreeMarker. Importing it also makes the preview reload when that file
   changes.

### Story for a layout or page

Pages and layouts can render parts inside their regions, all the way up to a story for an entire
page as it would look deployed:

```typescript
import type { Meta, StoryObj } from "@itemconsulting/storybook-framework-enonic-xp";
import id from "./default.ftl";
import layout1ColId from "../../layouts/layout-1-col/layout-1-col.ftl";
import articleHeaderId from "../../parts/article-header/article-header.ftl";
import { articleHeader } from "../../parts/article-header/article-header.stories"; // 1

export default {
  title: "Page/Article",
  parameters: {
    layout: "fullscreen",
    server: {
      id,
      params: {
        "com.example:layout-1-col": layout1ColId, // 2
        "com.example:article-header": articleHeaderId,
        "com.example:echo": "<h2>${title}</h2>", // 3
      },
    },
  },
} satisfies Meta;

export const Article: StoryObj = {
  args: {
    displayName: "My article page",
    homeUrl: "#",
    headerMenu: { menuItems: [] },
    mainRegion: { // 4
      name: "main",
      components: [
        {
          type: "layout",
          descriptor: "com.example:layout-1-col",
          path: "/main/0",
          config: {
            mainRegion: {
              name: "main",
              components: [
                {
                  type: "part",
                  descriptor: "com.example:article-header",
                  path: "/main/0/main/0",
                  config: articleHeader.args,
                },
                {
                  type: "part",
                  descriptor: "com.example:echo", // 5
                  path: "/main/0/main/1",
                  config: { title: "Echo this title" },
                },
              ],
            },
          },
        },
      ],
    },
  },
};
```

1. Reuse the `args` of other stories.
2. Name the templates that render the components in a region, by descriptor.
3. A named template can also be an inline template.
4. An arg ending with `Region` becomes a `com.enonic.xp.region.Region`.
   The server renders each component with the template named by its `descriptor` and its `config`
   as the model, and puts the result in the region.
5. Inline templates get `config` as their model in the same way.

### Java types

Args are sent to the server as query parameters, so their types can be lost on the way. When an
arg's name doesn't follow the [model value conventions](#model-value-conventions), use the
`javaTypes` param to tell the server which class it should be deserialized as. A key given a type
here is not matched by the conventions, so `"string"` opts an arg out of them:

```typescript
import id from "./timeline.ftl";
import type { Meta, StoryObj } from "@itemconsulting/storybook-framework-enonic-xp";

type FreemarkerParams = {
  title: string;
  startYear: number;
  endYear: number;
};

export default {
  title: "Part/Timeline",
  parameters: {
    server: {
      id,
      params: {
        javaTypes: {
          startYear: "number",
          endYear: "number",
        },
      },
    },
  },
} satisfies Meta<FreemarkerParams>;

export const Timeline: StoryObj<FreemarkerParams> = {
  args: {
    title: "This is a timeline",
    startYear: 2018,
    endYear: 2023,
  },
};
```

| Key               | Java type                     |
| ----------------- | ----------------------------- |
| `"zonedDateTime"` | `java.time.ZonedDateTime`     |
| `"localDateTime"` | `java.time.LocalDateTime`     |
| `"localDate"`     | `java.time.LocalDate`         |
| `"number"`        | `java.lang.Integer`           |
| `"region"`        | `com.enonic.xp.region.Region` |
| `"string"`        | `java.lang.String`            |

## Migrating from `@itemconsulting/xp-storybook-utils`

The helpers that were kept are exported under the same names, so most of the migration is a change
of import specifier:

1. Replace `@itemconsulting/xp-storybook-utils` with `@itemconsulting/storybook-framework-enonic-xp`
   in every import.
2. Remove `server: DEFAULT_XP_SERVER` (or `...DEFAULT_XP_SERVER`) from *.storybook/preview.ts*.
   The framework applies those settings itself, and `DEFAULT_XP_SERVER` is no longer exported. Keep
   any `url` or `params` you set on top of it.
3. `hideControl()`, `hideControls()` and `HIDE_OBJECT_CONTROL` were not carried over. Write the
   `argTypes` they produced directly instead:
   ```typescript
   argTypes: {
     headerMenu: { control: { type: "object" }, table: { disable: true } },
   },
   ```
4. `renderOnServer()` was not carried over either. Write the `parameters` it produced directly:
   `layout` stays at the top level, `id` goes in `server`, and every other key goes in
   `server.params`:
   ```diff
   -parameters: renderOnServer({ layout: "fullscreen", id, javaTypes: { year: "number" } }),
   +parameters: {
   +  layout: "fullscreen",
   +  server: { id, params: { javaTypes: { year: "number" } } },
   +},
   ```
   The string form, `renderOnServer(template)`, becomes `{ server: { params: { template } } }`.
5. `createPreviewServerParams()` was removed, together with the `matchers` param it produced. The
   xp-storybook app now types args by the [model value conventions](#model-value-conventions)
   instead. Remove the call from *.storybook/preview.ts*, and rename args or use `javaTypes` where
   the convention gives a different type than your matchers did — for example, names ending in
   `Time` are no longer read as dates.
6. `npm uninstall @itemconsulting/xp-storybook-utils`

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
mode, and fails fast with a clear message if the XP server is down:

```typescript
import { defineConfig } from "vitest/config";
import { defineXpStorybookProject } from "@itemconsulting/storybook-framework-enonic-xp/vitest";

// The async callback form works whether or not your project is ESM (`"type": "module"`).
export default defineConfig(async () => ({
  test: {
    projects: [await defineXpStorybookProject()],
  },
}));
```

The server check pings `http://localhost:8080/api/no.item.storybook:preview`, the framework's
default. If you point `parameters.server.url` in *preview.ts* elsewhere, pass the same URL as
`serverUrl`, or turn the check off with `checkServer: false`. `configDir` defaults to
`".storybook"`.

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
