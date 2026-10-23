---
"@itemconsulting/storybook-framework-enonic-xp": minor
---

`defineXpStorybookProject()` checks the XP server without being given its URL.

`serverUrl` now defaults to the URL the framework renders stories from
(`http://localhost:8080/api/no.item.storybook:preview`), so the check that fails the run early when
the server is down is on by default, and `defineXpStorybookProject()` needs no options. Pass
`serverUrl` only if you changed `parameters.server.url` in *preview.ts*, or `checkServer: false`
to turn the check off.
