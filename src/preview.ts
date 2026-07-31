import type { StoryContext } from "@storybook/server";

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
 * response as if it were the story.
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
  const fetchUrl = new URL(`${url}/${path}`);
  // Keep the query string identical to the renderer's default, or stories render differently
  // depending on whether this override is active.
  fetchUrl.search = new URLSearchParams({
    ...storyContext.globals,
    ...params,
  } as Record<string, string>).toString();

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
 * Framework-level preview annotations, injected via the `previewAnnotations` preset in
 * `preset.ts`. Applied before the project's own `preview.ts`, so anything set there wins.
 */
export const parameters = {
  server: {
    fetchStoryHtml,
  },
};
