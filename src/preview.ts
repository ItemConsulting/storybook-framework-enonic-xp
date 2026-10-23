import type { ServerRenderer, StoryContext } from "@storybook/server";
import type { Args, ArgTypes, RenderContext } from "storybook/internal/types";
import { simulateDOMContentLoaded, simulatePageLoad } from "storybook/preview-api";

// Replaced with the `appName` from gradle.properties by the `define` in `preset.ts`. Declared here
// rather than taken from @types/node, because this module runs in the browser.
declare const process: { env?: { APP_NAME?: string } } | undefined;

/**
 * Signature of the `parameters.server.fetchStoryHtml` hook read by the `@storybook/server`
 * renderer. Not exported by `@storybook/server`, so it's redeclared here.
 *
 * The renderer also accepts a DOM `Node`, but this package builds without the DOM lib and the
 * implementation below only ever resolves to an HTML string, so the return type is narrowed.
 */
export type FetchStoryHtml = (
  url: string,
  path: string,
  params: Record<string, unknown>,
  storyContext: StoryContext,
) => Promise<string>;

/** The URL to the local XP8 storybook */
export const DEFAULT_XP_SERVER_URL = "http://localhost:8080/api/no.item.storybook:preview";

/** How much of the response body to quote in the thrown error. */
const MAX_BODY_PREVIEW = 500;

/**
 * Turn an XP error response into something readable on one line. XP renders failures as
 * `<pre style="...">message</pre>`, and FreeMarker stack traces are long and mostly blank
 * space, so strip the tags and collapse whitespace before quoting it.
 */
function summarizeBody(body: string): string {
  const text = body
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > MAX_BODY_PREVIEW ? `${text.slice(0, MAX_BODY_PREVIEW)}…` : text;
}

/**
 * Build the story's query string from the globals and params, with params winning on a name
 * clash, as in the renderer's default.
 *
 * The renderer's default hands every value to `URLSearchParams` as-is, which stringifies it:
 * addon globals such as `backgrounds` and `viewport` are objects and reach XP as
 * `[object Object]`, and unset ones as `undefined`. So values that are not set are left out, and
 * objects and arrays are sent as JSON, the same encoding the renderer already uses for object args.
 */
function toSearchParams(values: Record<string, unknown>): URLSearchParams {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) {
      continue;
    }

    searchParams.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }

  return searchParams;
}

/**
 * Globals that Storybook's own addons consume in the browser: backgrounds, viewport, measure,
 * outline, accessibility and the vision simulator. In other Storybook stacks they never change what
 * a story renders, so they are not sent to XP, and changing one does not fetch the story again (see
 * `renderToCanvas`). Override the list with `parameters.server.excludeGlobals`.
 */
export const CLIENT_SIDE_GLOBALS: readonly string[] = [
  "a11y",
  "backgrounds",
  "measureEnabled",
  "outline",
  "viewport",
  "vision",
];

/** The `parameters.server` settings this module reads. */
type ServerParameters = {
  url: string;
  id?: string;
  params?: Record<string, unknown>;
  fetchStoryHtml?: (
    url: string,
    path: string,
    params: Record<string, unknown>,
    storyContext: StoryContext,
  ) => Promise<unknown>;
  excludeGlobals?: readonly string[];
};

/** The globals that are sent to XP: all of them, except those in `excludeGlobals`. */
function getServerGlobals(storyContext: StoryContext): Record<string, unknown> {
  const parameters = storyContext.parameters as { server?: ServerParameters } | undefined;
  const excludeGlobals = parameters?.server?.excludeGlobals ?? CLIENT_SIDE_GLOBALS;

  return Object.fromEntries(
    Object.entries(storyContext.globals ?? {}).filter(([key]) => !excludeGlobals.includes(key)),
  );
}

/** The URL a story is fetched from. Params win over globals of the same name. */
function buildFetchUrl(url: string, path: string, params: Record<string, unknown>, storyContext: StoryContext): URL {
  const fetchUrl = new URL(`${url}/${path}`);
  fetchUrl.search = toSearchParams({
    ...getServerGlobals(storyContext),
    ...params,
  }).toString();

  return fetchUrl;
}

/**
 * Whether the story is being executed by a test runner rather than displayed in the Storybook
 * preview iframe. This is what decides how a failed render is reported (see `fetchStoryHtml`).
 *
 * `@storybook/addon-vitest` runs stories as *portable stories*, and Storybook sets
 * `__isPortableStory` on the context for those — it is never set when the preview iframe
 * renders a story. The Vitest globals are a fallback for other portable-story setups.
 */
function isRunningInTestRunner(storyContext: StoryContext): boolean {
  const parameters = storyContext.parameters as { __isPortableStory?: boolean } | undefined;

  if (parameters?.__isPortableStory) {
    return true;
  }

  return "__vitest_browser_runner__" in globalThis || "__vitest_worker__" in globalThis;
}

/**
 * Same as the renderer's built-in `defaultFetchStoryHtml`, but it does not treat an error
 * response as if it were the story, it does not send unset or object values as `undefined` and
 * `[object Object]` (see `toSearchParams`), and it leaves out the globals that only the browser
 * uses (see `CLIENT_SIDE_GLOBALS`).
 *
 * `@storybook/server`'s default does `return (await fetch(fetchUrl)).text()` with no status
 * check, so a template that throws server-side (XP replies 500) still resolves to a string.
 * The renderer assigns that string to `canvasElement.innerHTML` and the story "renders" fine
 * — so a broken template passes as a green test under `@storybook/addon-vitest`.
 *
 * The two contexts want opposite things from that error page, so they get different handling:
 *
 * - **Test runner** — reject, so the story fails with the server's message. Rendering the
 *   error page here would be a false pass.
 * - **Storybook UI** — resolve with the body, so the XP error page (a FreeMarker stack trace,
 *   say) is displayed in the canvas where you can actually read and scroll it. Throwing here
 *   would replace it with a one-line message and hide the detail you opened the story to see.
 *   The same message is logged to the console so the failure is not silent.
 *
 * Override it per-story or in `preview.ts` (`parameters.server.fetchStoryHtml`) to opt out.
 */
export const fetchStoryHtml: FetchStoryHtml = async (url, path, params, storyContext) => {
  const fetchUrl = buildFetchUrl(url, path, params, storyContext);
  const response = await fetch(fetchUrl);
  // Read the body even on failure — for XP it holds the FreeMarker/Thymeleaf error.
  const body = await response.text();

  if (!response.ok) {
    const status = response.statusText ? `${response.status} ${response.statusText}` : `${response.status}`;
    // Only the endpoint, not the query string: story args are serialized into it, and a story
    // with a large `args` object produces kilobytes of percent-encoding that buries the
    // server's actual error message.
    const paramCount = Array.from(fetchUrl.searchParams.keys()).length;

    const message =
      `The XP server returned ${status} when rendering story "${path}".\n` +
      `Response: ${summarizeBody(body) || "(empty body)"}\n` +
      `Request: ${fetchUrl.origin}${fetchUrl.pathname} (${paramCount} query parameters)`;

    if (isRunningInTestRunner(storyContext)) {
      throw new Error(message);
    }

    console.error(message);
  }

  return body;
};

/**
 * The parts of the canvas element used here. Declared locally, because this package builds
 * without the DOM lib.
 */
type Canvas = {
  innerHTML: string;
  firstChild: unknown;
  appendChild(node: unknown): unknown;
};

/** The request each canvas was last rendered from, to tell when a re-render can be skipped. */
const renderedRequests = new WeakMap<object, string>();

/**
 * Same conversion of args as the renderer's (not exported) `buildStoryArgs`: date controls are
 * sent as ISO strings, and object controls as JSON.
 */
function buildStoryArgs(args: Args, argTypes: ArgTypes): Args {
  const storyArgs = { ...args };

  for (const [key, argType] of Object.entries(argTypes)) {
    const { control } = argType;
    const controlType =
      control && typeof control === "object" && "type" in control && typeof control.type === "string"
        ? control.type.toLowerCase()
        : undefined;

    if (controlType === "date") {
      storyArgs[key] = new Date(storyArgs[key] as string | number).toISOString();
    } else if (controlType === "object") {
      storyArgs[key] = JSON.stringify(storyArgs[key]);
    }
  }

  return storyArgs;
}

/**
 * Same as the `@storybook/server` renderer's `renderToCanvas`, except that it does not fetch and
 * replace the story when the request to XP would be the same as last time.
 *
 * Storybook re-renders the story whenever a global changes. Other renderers do that in memory and
 * keep the DOM, but the server renderer fetches the HTML again and replaces the canvas. So without
 * this, picking a background or a viewport would hit XP and reset the story's DOM: typed input,
 * focus and anything the story's scripts set up. Since `CLIENT_SIDE_GLOBALS` are not part of the
 * request, changing one now leaves the story as it is, the way it does in other stacks. Changed
 * args still fetch the story again, and so does a remount (`forceRemount`), which is what Storybook
 * does when a story is first shown or you click "Remount".
 */
export async function renderToCanvas(
  { id, title, name, showMain, showError, forceRemount, storyFn, storyContext }: RenderContext<ServerRenderer>,
  canvasElement: Canvas,
): Promise<void> {
  storyFn();

  const { parameters, args, argTypes } = storyContext;
  const server = parameters.server as ServerParameters;
  const path = server.id || id;
  const params = { ...server.params, ...buildStoryArgs(args, argTypes) };
  const request = buildFetchUrl(server.url, path, params, storyContext).href;

  if (!forceRemount && renderedRequests.get(canvasElement) === request) {
    showMain();
    return;
  }

  const element = await (server.fetchStoryHtml ?? fetchStoryHtml)(server.url, path, params, storyContext);
  const { Node } = globalThis as { Node?: abstract new () => unknown };

  showMain();

  if (typeof element === "string") {
    canvasElement.innerHTML = element;
    simulatePageLoad(canvasElement);
  } else if (Node && element instanceof Node) {
    if (canvasElement.firstChild !== element || forceRemount) {
      canvasElement.innerHTML = "";
      canvasElement.appendChild(element);
      simulateDOMContentLoaded();
    }
  } else {
    showError({
      title: `Expecting an HTML snippet or DOM node from the story: "${name}" of "${title}".`,
      description: "Did you forget to return the HTML snippet from `parameters.server.fetchStoryHtml`?",
    });
    renderedRequests.delete(canvasElement);
    return;
  }

  renderedRequests.set(canvasElement, request);
}

/**
 * Framework-level preview annotations, injected via the `previewAnnotations` preset in
 * `preset.ts`. Applied before the project's own `preview.ts`, so anything set there wins.
 * Storybook merges `parameters` deeply, so a project can override `server.url` alone and still
 * keep `xpAppName`.
 */
export const parameters = {
  server: {
    url: DEFAULT_XP_SERVER_URL,
    params: {
      // Only send this when it is actually set. URLSearchParams stringifies an undefined value to the
      // literal "undefined", which the server would then treat as a real application name — and its
      // "missing xpAppName" error says more than a lookup of an application called "undefined" would.
      ...(process?.env?.APP_NAME && { xpAppName: process.env.APP_NAME }),
    },
    fetchStoryHtml,
  },
};
