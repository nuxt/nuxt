# nuxt-issue STATE

**Issue:** https://github.com/nuxt/nuxt/issues/35801
**Kind:** fix
**PR:** https://github.com/nuxt/nuxt/pull/35802 (draft)
**Branch:** fix/issue-35801-fetch-lazy-import
**Base:** main
**Started:** 2026-07-22
**Iteration:** 1 / 3

## Goal

Node-environment Vitest can import modules that auto-import `$fetch` without `ReferenceError: window is not defined` at import time.

## Acceptance / repro

- Under `@nuxt/test-utils` (`ssr: false` → client `#build/fetch`), importing code that references auto-imported `$fetch` must not call `baseURL()` until a request runs (or `globalThis.$fetch` is already set in tests).
- Regression from 4.5.0 (#35581) fixed for the reported Vitest node path.
- No change to server fetch seeding / client ofetch tree-shake (#35790).

## Out of scope

- `fetch.server.mjs` / fetch-setup
- `nitro.client.mjs` window guard
- Vitest environment defaults
- Docs

## Contribution checks

- [ ] feat confirmed by maintainer (if kind=feat)
- [x] issue describes the bug (if kind=fix)
- [ ] docs style applicable (if docs touched)

## Plan

Done: client-only `dollarFetchClientTemplate` with `createFetch` + `_$fetch.native` + `defaults.get baseURL`.

## Files touched

- packages/nuxt/src/core/templates.ts
- packages/nuxt/test/templates.test.ts

## Gates

| Gate | Command | Exit | Notes |
|------|---------|------|-------|
| lint (code) | eslint templates.ts templates.test.ts | 0 | |
| test (focused) | vitest run packages/nuxt/test/templates.test.ts | 0 | 6/6 |
| other | full bundle | skipped | #35790 path (fetch-setup.client) untouched |

## Maker / Checker

- Maker model: composer
- Checker model: [Checker](d3c28bd7-ebf2-4914-87b4-0ae42336c3f3) PASS-WITH-NITS (smoke duplicates generated code; non-blocking)

## Lessons

- `@nuxt/test-utils` forces `ssr: false` → client fetch template in node Vitest repro.
- Bare `createFetch({ defaults })` binds `globalThis.fetch` at create time; need `fetch: _$fetch.native`.
- #35800 AgentScan: keep PR body in human voice.

## Open questions

None.

## Human gate

- [ ] Contributor can explain every behavior/docs claim
- [x] PR prose stop-slop'd and in human voice
- [x] No `🤖🤖🤖` / bot-bait title
- [ ] Ready to mark PR ready-for-review? (default: no until user says so)
