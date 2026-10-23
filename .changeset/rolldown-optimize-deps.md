---
"@itemconsulting/storybook-framework-enonic-xp": patch
---

Stop Vite 8 from warning that `optimizeDeps.esbuildOptions` is deprecated.

On Vite 8 the framework now passes its `define` to the dependency optimizer through
`optimizeDeps.rolldownOptions`. Vite 5–7 still get `optimizeDeps.esbuildOptions`.
