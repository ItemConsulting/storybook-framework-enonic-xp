---
"@itemconsulting/storybook-framework-enonic-xp": major
---

Require `appName` in gradle.properties, and stop sending the resources directory

The Enonic XP storybook app no longer takes a directory to read templates from; it reads them out of
an installed application instead. `appName` is therefore no longer optional — Storybook fails to
start when it is missing, rather than letting every story fail against the server.
