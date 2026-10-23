---
"@itemconsulting/storybook-framework-enonic-xp": minor
---

React to error responses from the XP server instead of rendering them as the story.

`@storybook/server`'s built-in `fetchStoryHtml` never checks `response.ok`, so a template that throws server-side (XP replies 500) still resolved to a string. The renderer assigned that error page to `canvasElement.innerHTML`, which meant a broken template passed as a green test under `@storybook/addon-vitest`.

The framework now ships preview annotations with a `fetchStoryHtml` that handles a non-2xx response differently per context, because each wants the opposite thing from the error page:

- **Test runner** — the story fails, quoting the status and the server's error message (HTML tags stripped, so FreeMarker/Thymeleaf errors are readable on one line). The query string is omitted from the reported URL, since serialized story args would otherwise bury the message.
- **Storybook UI** — the error page is rendered in the canvas as before, so the full stack trace stays readable and scrollable, with the same summary logged via `console.error`.

The two are distinguished by `__isPortableStory`, which Storybook sets on stories composed by a portable-stories runner and never sets in the preview iframe.

Set `parameters.server.fetchStoryHtml` in your `preview.ts` or on a story to override it.
