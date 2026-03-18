---
title: Debug Playbook
description: Practical first steps for debugging issues across Nuxt core packages.
---

## Goal

Use this playbook to quickly identify the right package, entry point, and test scope for a new bug.

## 1) Classify the Issue First

- UI, routing, page metadata, composables behavior: start with `packages/nuxt`.
- Dev server startup, optimize deps, module transforms, vite-node bridge: start with `packages/vite`.
- Server rendering, handlers, middleware, route rules, h3 runtime errors: start with `packages/nitro-server`.
- Type/config contract mismatches: inspect `packages/schema` and generated `.nuxt/types`.

## 2) Find the First Entry Point

- Nuxt core orchestration: `packages/nuxt/src`.
- Vite builder bootstrap: `packages/vite/src/vite.ts`.
- Vite plugin behavior: `packages/vite/src/plugins`.
- Nitro runtime bootstrap: `packages/nitro-server/src/index.ts`.
- Nitro runtime handlers: `packages/nitro-server/src/runtime`.

## 3) Reproduce Minimally

1. Reproduce with the smallest fixture possible.
2. Prefer existing fixtures in `test/fixtures` when they match the bug shape.
3. Keep reproduction deterministic before changing production code.

## 4) Add Regression Coverage

- Package-level behavior: add tests under matching package test folder.
- Cross-package integration behavior: add tests under `test`.
- Keep assertions focused on the reported regression and expected invariant.

## 5) Validate Before Commit

1. Run only targeted tests first.
2. Confirm no unrelated file drift in `git status`.
3. Record a short note in `PROGRESS.md` with issue number, fix summary, and validation command.

## Quick Triage Matrix

- "Layout/meta mismatch": `packages/nuxt` + page/metadata tests.
- "Dev fails to boot": `packages/vite` + vite-node/dev-server tests.
- "Runtime 500 on request": `packages/nitro-server` + handler/runtime tests.
- "Type suddenly any/missing": `packages/schema` + generated type output + fixture type checks.
