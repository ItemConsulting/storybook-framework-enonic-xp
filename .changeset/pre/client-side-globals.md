---
"@itemconsulting/storybook-framework-enonic-xp": minor
---

Make the backgrounds, viewport and accessibility addons behave as in other Storybook setups.

- The globals of Storybook's own addons (`a11y`, `backgrounds`, `measureEnabled`, `outline`,
  `viewport` and `vision`) are no longer sent to XP. Those addons work in the browser. Change the
  list with `parameters.server.excludeGlobals`; the default is exported as `CLIENT_SIDE_GLOBALS`
  from `@itemconsulting/storybook-framework-enonic-xp/preview`.
- The framework now has its own `renderToCanvas`, which does not fetch the story from XP again when
  the request would be unchanged. Picking a background or a viewport, or toggling outline or
  measure, no longer reloads the story, so it keeps its DOM state, such as text typed into a form.
  Changed args and a remount still fetch the story again.
