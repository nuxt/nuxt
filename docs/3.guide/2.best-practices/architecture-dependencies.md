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

## Maintenance Notes

- Keep this dependency map updated when package boundaries or orchestration behavior change.
- Add links to concrete source files when documenting issue-specific architecture notes.
