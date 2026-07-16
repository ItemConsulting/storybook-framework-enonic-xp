# Contributing

Thanks for taking the time to contribute! This document covers the local
development workflow and how releases are cut.

## Prerequisites

- **Node.js** — `>=24.0.0` (see `package.json` "engines"). A matching `.nvmrc`
  is provided, so `nvm use` selects the right version.
- **npm** — this repo installs with `engine-strict=true`, so an unsupported
  Node version will fail fast.

## Getting started

```bash
git clone git@github.com:ItemConsulting/storybook-framework-enonic-xp.git
cd storybook-framework-enonic-xp
npm ci        # reproducible install from package-lock.json
```

## Development workflow

| Task | Command |
| --- | --- |
| Build (TypeScript → `dist/`) | `npm run build` |
| Run tests (builds first, then `node --test`) | `npm test` |
| Lint + format + organize imports (auto-fix) | `npm run lint` |
| Lint/format check without writing (what CI runs) | `npm run lint:ci` |

Formatting and linting are handled by [Biome](https://biomejs.dev/) — its
config lives in `biome.json`. Run `npm run lint` before committing so CI stays
green; `npm run lint:ci` fails on any unformatted or lint-flagged code.

## Continuous integration

Every push to `main` and every pull request runs the **CI** workflow
(`.github/workflows/main.yml`): it installs with `npm ci`, runs `npm run
lint:ci`, and runs `npm test` on Node 24. **CodeQL**
(`.github/workflows/codeql.yml`) provides security scanning on PRs and weekly.
Please make sure CI passes before requesting review.

## Releasing

Releases are automated with [Changesets](https://github.com/changesets/changesets).
You never bump the version or publish by hand.

### 1. Add a changeset with your PR

Any change that should ship a new version needs a changeset. From your feature
branch:

```bash
npx changeset
```

This prompts you for the bump type and a summary:

- **patch** — bug fixes, docs, internal changes with no API impact
- **minor** — new, backwards-compatible features
- **major** — breaking changes

It writes a markdown file under `.changeset/`. Commit that file alongside your
code changes. (Pure-internal changes that never need a release — e.g. CI tweaks
— can skip the changeset.)

### 2. Merge to `main`

When your PR merges, the **Publish** workflow (`.github/workflows/publish.yml`)
runs. If unreleased changesets exist, it opens (or updates) a **"Version
Packages"** PR that:

- consumes the `.changeset/` files,
- bumps the version in `package.json`,
- and updates `CHANGELOG.md`.

### 3. Merge the "Version Packages" PR to publish

Merging that PR triggers the Publish workflow again, which this time:

- publishes the package to npm (`changeset publish`, public access, with
  [provenance](https://docs.npmjs.com/generating-provenance-statements)),
- pushes the git tag,
- and creates the matching GitHub Release.

That's the whole release: **add a changeset → merge → merge the Version
Packages PR.**

### Maintainer setup (one-time)

For publishing to work, the repository must have an `NPM_TOKEN` secret with
publish rights to the `@itemconsulting` scope, and Settings → Actions →
General must allow GitHub Actions to create and approve pull requests.
