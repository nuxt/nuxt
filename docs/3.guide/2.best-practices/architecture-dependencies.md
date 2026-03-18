---
title: Architecture Dependencies
description: Logical dependency map between Nuxt core packages and runtime/build/test flows.
---

## Core Dependency Map

- `packages/nuxi` orchestrates local commands and delegates runtime and build concerns to Nuxt core.
- `packages/nuxt` is the central coordinator and depends on:
  - `packages/schema` for typed config contracts.
  - `packages/kit` for module, template, and build utilities.
  - `packages/vite` for builder and dev-server integration.
  - `packages/nitro-server` for server runtime integration.
- `packages/vite` and `packages/nitro-server` are tightly coupled in dev SSR flow (module resolution, vite-node runner, server execution).
- `test`, `packages/nuxt/test`, `packages/vite/test`, and Nitro tests provide regression coverage across package boundaries.

## Build, Runtime, and Test Flow

1. CLI flow starts in `packages/nuxi` and initializes Nuxt core.
2. Nuxt core prepares templates, modules, and runtime wiring.
3. Vite handles client and SSR bundling.
4. Nitro handles server runtime, rendering, middleware, and API entry points.
5. Tests validate behavior at package level and integration level.

## Practical Debugging Entry Points

- UI, routing, page metadata, app composables: start in `packages/nuxt`.
- Dev server, optimizeDeps, vite-node, transform pipeline: start in `packages/vite`.
- Server runtime, handlers, rendering, route rules, h3 integration: start in `packages/nitro-server`.
- Type and config contract mismatches: inspect `packages/schema` and generated `.nuxt/types` outputs.

## Entry Points by Area

### Nuxt Core

- Scope: module orchestration, templates, app wiring, composable/runtime integration.
- Start from: `packages/nuxt/src`.

### Vite Builder

- Scope: dev server startup, optimizeDeps, vite-node bridge, transform/build behavior.
- Start from: `packages/vite/src/vite.ts` and `packages/vite/src/plugins`.

### Nitro Server Runtime

- Scope: server handlers, rendering, middleware, route rules, runtime utilities.
- Start from: `packages/nitro-server/src/index.ts` and `packages/nitro-server/src/runtime`.

### Schema and Type Contracts

- Scope: public config and runtime type contracts shared across packages.
- Start from: `packages/schema/src`.

### CLI

- Scope: command execution flow for dev/build/prepare and local tooling entry.
- Start from: `packages/nuxi/src`.

### Tests and Regression Safety

- Scope: package-level unit tests and integration fixtures.
- Start from: `packages/nuxt/test`, `packages/vite/test`, `packages/nitro-server/test`, and `test`.

## Maintenance Notes

- Keep this dependency map updated when package boundaries or orchestration behavior change.
- Add links to concrete source files when documenting issue-specific architecture notes.
- Use the debug checklist in `docs/3.guide/2.best-practices/debug-playbook.md` for issue triage and regression workflow.
