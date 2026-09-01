# nuxt-issue STATE

**Issue:** https://github.com/nuxt/nuxt/issues/25323
**Kind:** feat
**PR:** https://github.com/nuxt/nuxt/pull/35800
**Branch:** feat/issue-25323-remove-process-flags
**Base:** main
**Started:** 2026-07-22
**Iteration:** 1 / 3

## Goal

Per @danielroe: keep `process.*` build-time defines; remove `NodeJS.Process` type augmentation for the five deprecated flags.

## Acceptance / repro

- Defines for `process.browser/client/dev/server/test` remain in Vite/schema/Webpack
- `NodeJS.Process` no longer declares those properties
- Docs describe type augmentation removal, not define removal
- `process.prerender` / `process.nitro` untouched

## Out of scope

- Removing define blocks (explicitly declined by maintainer)
- `import.meta.nuxt.*`, jiti, test-utils mocking, codemod

## Contribution checks

- [x] feat confirmed by maintainer — danielroe feedback on #35800
- [x] docs style applicable — upgrade.md + import-meta note

## Plan

Pivoted after review: restore defines, remove type augment only.

## Files touched

- packages/vite/src/shared/client.ts
- packages/vite/src/shared/server.ts
- packages/vite/src/vite-node-entry.ts
- packages/schema/src/config/vite.ts
- packages/webpack/src/presets/base.ts
- packages/schema/test/vite-define.spec.ts (new)
- packages/vite/test/env-define.test.ts (new)
- packages/webpack/test/env-define.test.ts (new)
- docs/1.getting-started/18.upgrade.md

## Gates

| Gate | Command | Exit | Notes |
|------|---------|------|-------|
| lint (code) | `pnpm lint` | 0 | |
| test:unit | `pnpm test:unit` | 0 | 1209 passed |
| test:runtime | `pnpm test:runtime` | 0 | 783 passed |
| lint:docs | `pnpm lint:docs` | 0 | |
| typecheck:docs | `pnpm typecheck:docs` | 0 | |
| focused | `vitest run ...env-define...` | 0 | 10 tests |

## Maker / Checker

- Maker model: composer-2.5-fast
- Checker model: claude-sonnet-5-thinking-high — PASS after reverting unrelated ui-template header churn

## Human gate

- [ ] Contributor can explain every behavior/docs claim
- [x] PR prose stop-slop'd (API body update); AgentScan still labeled `possible bot` — do not reply to flag unless user asks
- [x] No bot-bait title
- [ ] Ready to mark PR ready-for-review? (default: no)

## CI notes

- First run: Windows `fixtures:vite-dev-*` failed with `EADDRINUSE` / server exited — flaky, unrelated to process defines
- Re-triggered with empty commit `852285741d`; Windows vite-dev fixtures **passed** (9m14s)
- AgentScan: `agentscan:mixed-signals` + `possible bot` on open; body updated; no reply posted per user request
