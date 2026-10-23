### Server errors fail the story

`@storybook/server`'s built-in fetch does not check the HTTP status, so a template that throws
server-side would render XP's error page as if it were the component — passing as a green test.
This framework replaces it with a `fetchStoryHtml` that reacts to a non-2xx response, and the
two contexts are handled differently because they want opposite things from that error page:

| Context | Behaviour |
| --- | --- |
| Test runner (`@storybook/addon-vitest`) | The story **fails**, with the server's message. Rendering the error page here would be a false pass. |
| Storybook UI | The error page is **rendered in the canvas**, so you can read and scroll the full FreeMarker/Thymeleaf stack trace. The same summary is logged with `console.error`. |

The two are told apart by `__isPortableStory`, which Storybook sets on stories composed by a
portable-stories runner and never sets in the preview iframe.

The failure message quotes the status and the server's message, with HTML tags stripped so it
stays readable on one line:

```
The XP server returned 500 Server Error when rendering story "site/parts/arrangement/arrangement.ftlh".
Response: FreeMarker template error ... The following has evaluated to null or missing: ==> isAdministrationSite2 [in template "site/parts/arrangement/arrangement.ftlh" at line 14, column 17] ...
Request: http://localhost:8080/api/no.item.storybook:preview/site/parts/arrangement/arrangement.ftlh (19 query parameters)
```

The query string is omitted from the reported URL, since serialized story args would otherwise
bury the message.

To opt out, or to accept some statuses, set your own `fetchStoryHtml` in `preview.ts` (or on a
single story) — the project's own annotations take precedence over the framework's:

```typescript
export default {
  parameters: {
    server: {
      ...DEFAULT_XP_SERVER,
      fetchStoryHtml: async (url, path, params, storyContext) => {
        /* ... */
      },
    },
  },
} satisfies Preview;
```
