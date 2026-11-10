# Architecture

This is a map of the `nuxt/nuxt` monorepo for contributors: what each package does, how a Nuxt app is loaded, built and rendered, and which tests to add for a change. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and conventions.

## Packages

| Package | Published as | Role |
| --- | --- | --- |
| `packages/nuxt` | `nuxt` | Core: config loading, the build pipeline, internal modules, the Vue app runtime and the portable server renderer |
| `packages/kit` | `@nuxt/kit` | Toolkit for module authors, also used by every other package to read and extend the current Nuxt instance |
| `packages/schema` | `@nuxt/schema` | Public types (`NuxtConfig`, `NuxtOptions`, hooks) and the config resolvers that produce defaults |
| `packages/vite` | `@nuxt/vite-builder` | Default bundler for the app (client and SSR bundles) |
| `packages/webpack`, `packages/rsbuild`, `packages/rspack` | `@nuxt/webpack-builder`, `@nuxt/rsbuild-builder`, `@nuxt/rspack-builder` | Alternative bundlers (`builder: 'webpack' \| 'rsbuild' \| 'rspack'`); rspack is deprecated in favour of rsbuild |
| `packages/nitro-server` | `@nuxt/nitro-server` | Default server builder: builds the server with Nitro and adapts Nitro to the renderer |
| `packages/vite-server` | `@nuxt/vite-server` | Experimental server builder that builds the server with Vite alone (`server.builder: 'vite'`) |
| `packages/ui-templates` | private | Source of the HTML templates (error pages, loading screen, welcome page); the build writes them into `nuxt`, `kit` and `schema`, where they are committed |

Two kinds of builder are pluggable. The **bundler** (`nuxt.options.builder`, loaded in `packages/nuxt/src/core/builder.ts`) compiles the Vue app. The **server builder** (`nuxt.options.server.builder`, loaded in `packages/nuxt/src/core/server.ts`, default `@nuxt/nitro-server`) produces the server that renders it.

## Lifecycle of a Nuxt app

### Loading (`packages/nuxt/src/core/nuxt.ts`)

`loadNuxt` calls `@nuxt/kit`'s `loadNuxtConfig`, which wraps c12. That function scans and dedupes `layers/`, resolves `extends`, imports config files natively with a jiti fallback, and applies the `@nuxt/schema` resolvers. `loadNuxt` then normalises options and pushes the internal modules onto `options._modules`: `pages`, `head`, `components`, `compiler`, `imports` and `schema`. Finally it creates the instance.

`initNuxt` reads top to bottom as the boot sequence:

1. User hooks and the compatibility date.
2. `setupTypes` (`core/typescript.ts`): generated tsconfigs, references and paths.
3. `addCoreBuildPlugins` (`core/build-plugins.ts`): the transforms core applies to app code.
4. `resolveModules` and `installModules` (`core/modules.ts`, kit `module/install.ts`), with built-in components and plugins added before and after them (`core/builtins.ts`).
5. `modules:done`, then `bundleServer` (`core/server.ts`), then `ready`.

Built-ins registered before modules are installed can be seen and overridden by modules; those that depend on options modules may change are registered after them. To add a built-in plugin or component, edit the right phase in `core/builtins.ts`.

### Internal modules

Each feature area is a Nuxt module installed from `core/nuxt.ts`. Build-time code sits at the root of each directory, and app code (where there is any) in `runtime/`:

- `pages/` (`nuxt:pages`): route scanning (`utils.ts`, on top of `unrouting`), `definePageMeta` / `defineRouteRules` extraction (`page-meta-extraction.ts`), the `#build/routes` template (`normalizeRoutes`), server-side route patterns for early 404s and SPA preloads (`route-patterns.ts`), static analysis of `router.options` (`router-options.ts`), inline route rules (`route-rules.ts`) and typed routes (`typed-router.ts`). When pages are disabled (by default, when there are no pages, routes or `router.options` files), it installs the universal router (`app/plugins/router.ts`) instead of vue-router.
- `components/` (`nuxt:components`): directory scanning, `#components` templates and the component transforms. By default, tags are resolved in the Vue compiler (`compiler-resolver.ts`). With `experimental.compilerComponentResolution: false`, `plugins/loader.ts` rewrites compiled output instead. Both share `utils.ts`.
- `head/` (`nuxt:meta`): Unhead integration and the `<Head>`-family components.
- `imports/` (`nuxt:imports`): auto-imports through unimport (`presets.ts`, `transform.ts`).
- `compiler/` (`nuxt:compiler`): keyed functions. Stable keys are injected into `useAsyncData`, `useFetch`, `useState` and friends, and into factories created with `defineKeyedFunctionFactory`.

Shared build-time helpers live in `core/utils/` (`parse-utils.ts` for static AST and SFC script parsing, `route-rules.ts` for the rule matcher compiler, `plugins.ts` for id filters). `core/plugins/` holds core transforms.

### Building (`packages/nuxt/src/core/builder.ts`)

`build` creates the app (`core/app.ts`). It resolves layouts, middleware, plugins and app config across layers, renders `core/templates.ts` and `build.templates` into the virtual file system (`#build/*`), and calls the bundler's `bundle`. In dev it watches files and regenerates only the templates that depend on what changed (`core/template-dependencies.ts`).

### Bundlers

Each bundler package implements `NuxtBuilder` (`bundle(nuxt)`, plus `setupWatcher` for vite).

- **`@nuxt/vite-builder`:**
  - `src/vite.ts` builds one Vite config with `client` and `ssr` environments (`src/shared/client.ts`, `src/shared/server.ts`).
  - It registers the Nuxt plugins from `src/plugins/`, one feature per file: client manifest, SSR styles, public dirs, dev server, optimize-deps hints, type checking, and so on.
  - It then runs `createBuilder().buildApp()` for a build, or `createServer()` plus warmup in dev.
  - In dev, when the server builder builds the server separately (for example Nitro without `experimental.nitroViteEnvironment`), `plugins/vite-node.ts` serves SSR modules over a socket to the runner in `vite-node-runner.ts`. The runner and its socket client are separate entries loaded by the server, so they must not import `@nuxt/kit`.
- **`@nuxt/webpack-builder`:**
  - Bundler implementations are injected through `builder-registry.ts`, so the same presets (`src/presets/*`, composed in `src/configs/{client,server}.ts`) also produce Rspack configs.
  - `utils/options.ts` maps Nuxt options to bundler options and is shared with rsbuild.
- **`@nuxt/rspack-builder`** registers the Rspack implementations (`impl.ts`). Its `rsbuild.ts` hands the webpack-style configs to Rsbuild, which runs the dev server and compilers.
- **`@nuxt/rsbuild-builder`:**
  - It builds a native Rsbuild config (`config.ts`) and adds Nuxt behaviour as Rsbuild plugins (`src/plugins/`).
  - It imports shared webpack helpers by relative path, so their dependencies are also listed in its own `package.json`.

### App runtime (`packages/nuxt/src/app`)

- `entry.ts` (or lazily, through `entry.async.ts`) calls `createNuxtApp` (`nuxt.ts`), applies plugins and, on the client, mounts the root component (`components/nuxt-root.vue` by default). `entry-spa.ts` is the empty server entry used when SSR is off.
- `NuxtApp` holds the hooks, the payload, `runWithContext` and the internal state composables keep.
- Composables live in `composables/`, one public feature per file, re-exported through `#app`.
- Data fetching is built on `composables/asyncData.ts`. `fetch.ts` builds `useFetch` on top of it.
- The payload is serialised with devalue by the renderer (`runtime/server/renderer/payload.ts`). `plugins/revive-payload.server.ts` registers the reducers for custom types, and `plugins/revive-payload.client.ts` revives them.
- Build-time flags reach the runtime through `#build/nuxt.config.mjs`. Route rules are read only through `getRouteRules`.
- Dev-only diagnostics live in `diagnostics/` and must be guarded by `import.meta.dev`, so production builds tree-shake them.

### Server rendering (`packages/nuxt/src/runtime/server/renderer`)

The renderer is web-standard and has no Nitro or h3 dependency: `createNuxtRenderer(options).fetch(event)` takes a request event and returns a `Response`.

- **Inputs:**
  - Each server builder supplies `NuxtRendererOptions` (`runtime.ts`): runtime config, asset URLs, route rules, hooks and error handling.
  - Build artifacts come from `nuxt/internal/*` aliases.
- **Request flow:**
  - `index.ts` dispatches to the server builder's island renderer (which uses the helpers in `islands.ts`), the error route, or `renderRoute`.
  - `renderRoute` handles early 404s and payload extraction, then either buffers the response (`head.ts`, `document.ts`) or streams it (`stream.ts`).
  - With `experimental.inlineErrorRendering`, failed renders are handled in `error-page.ts`. Otherwise the error goes to the server builder's error handler.
- **Supporting code:**
  - `packages/nuxt/src/server` (`nuxt/server`) has portable request helpers (session, cors, validation, fetch). A server builder can replace them with its own implementation; nitro-server uses an h3-backed one.
  - `runtime/server/dev-error` builds and streams dev error reports to the overlay.

In `@nuxt/nitro-server`, `src/index.ts` assembles the Nitro config. `runtime/handlers/renderer.ts` adapts Nitro to the renderer, and `runtime/compat/*` backs the `nitroLegacy` option. `@nuxt/vite-server` does the same without Nitro: `runtime/renderer.ts` for the request handler, and `prerender.ts` and `output.ts` for `nuxt generate`.

## Tests

Test at the cheapest layer that genuinely covers the behaviour. Unit, renderer and runtime tests are fast; fixture, bundle and E2E tests need real builds and are much slower.

| Layer | Location | What belongs there | Command |
| --- | --- | --- | --- |
| Unit | `packages/*/test/*.test.ts`, `scripts/*.test.ts` | Transforms, templates, config resolution, kit helpers, server utilities, runtime code that needs no Nuxt app (happy-dom where a DOM is needed) | `pnpm test:unit` |
| Renderer | `test/renderer` | The server renderer against `test/fixtures/standalone-renderer`, which `test/setup-renderer-prepare.ts` builds first | `pnpm test:unit` |
| Runtime | `test/nuxt` | Composables and components mounted in a Nuxt app without a build (`vitest-environment-nuxt`; the app is the root `nuxt.config.ts` with `test/runtime/app`). Projects: `nuxt`, `nuxt-universal` (`pages: false`), `nuxt-dev` (`import.meta.dev`) | `pnpm test:runtime` |
| Fixture | `test/*.test.ts`, `test/fixtures/*` | Behaviour that needs a real build or dev server: SSR output, server routes, route rules, payloads, builder output | `pnpm test:fixtures` |
| Bundle | `test/bundle.test.ts` | Client and server bundle size snapshots and tree-shaking | `pnpm test:bundle` |
| E2E | `test/e2e` (Playwright) | Only what needs a browser: hydration, client navigation, HMR, the dev error overlay | `pnpm test:e2e` |
| Types | `test/fixtures/*` with a `test:types` script (`basic-types`, `minimal-types`, `route-types-*`, ...) | Generated types, with `nuxt prepare` and `vue-tsc` per fixture | `pnpm test:types` |

There are also `pnpm typecheck` (root `vue-tsc`), `pnpm test:attw` and `pnpm test:public-api` (published package shape), `pnpm lint:knip` (unused code and dependencies) and benchmarks. The `*.bench.ts` files are CodSpeed microbenchmarks. `pnpm bench` (`bench/`) compares packed builds against a baseline; see `bench/README.md`.

### The fixture matrix

Fixture suites run once per project of the `fixtures:<builder>-<env>-<context>-<manifest>` matrix in `vitest.config.ts`, plus a few `-legacy-*` projects that turn off `inlineErrorRendering` or `compilerComponentResolution`. `test/matrix.ts` exposes the current project's axes (`builder`, `isDev`, `asyncContext`, ...). A fixture opts into them by wrapping its config in `withMatrix()`.

Most behaviour does not depend on every axis. Guard each suite with the narrowest helper from `test/matrix.ts`, so that it builds and runs only where it adds coverage:

- `runsOnceInMatrix`: one project (vite, built, defaults).
- `runsOncePerEnvInMatrix`: one dev and one built project.
- `runsOncePerViteBuilderInMatrix`: vite and nitro-vite, dev and built.
- `runsOncePerBuilderInMatrix`: one built project per builder.
- `runsOncePerBuildInMatrix`: one dev and one built project per builder, for behaviour that depends on the compiled app.

All of these are false in the legacy projects. A suite that asserts on a legacy option opts in with `|| legacyErrorRendering` or `|| legacyComponentResolution`. `test/basic.test.ts` declares a few more guards at the top of the file. Pass the guard to `setupFixture(name, runs, options)` from `test/utils.ts`, so that projects that skip the suite also skip the build.

To add a fixture test, prefer adding a page to an existing fixture that is already built in the projects you need, or vary one with `setupFixture` config overrides or a `$env` block. Create a new fixture directory only when the config would interfere with others. Suites that edit their fixture or start their own server work on a copy: `copyFixture` and `editFixture` in `test/fixture-copy.ts`, or `useTempFixture` in `test/e2e/temp-fixture.ts` for Playwright.

### E2E projects

`playwright.config.ts` defines a project for each bundler and environment it covers. Name lists in that file restrict suites that only make sense in dev, in built output, or with vite. A client runtime suite that does not depend on build output belongs in `runtimeTests`, which runs only against vite dev and built.

## Where to change things

- **A config option or its default:** the resolver in `packages/schema/src/config/*.ts`, tested in `packages/schema/test/config.test.ts`.
- **A composable or built-in component:** `packages/nuxt/src/app/composables` or `app/components`, tested in `test/nuxt/<feature>.test.ts`, or in `packages/nuxt/test` if it needs no app. Built-in components are registered in `core/builtins.ts`.
- **Routing or page meta:** `packages/nuxt/src/pages`. To decide which `definePageMeta` keys reach the route record, edit `classifyPageMetaProperty`. For generated route code, edit `normalizeRoutes`.
- **Component resolution:** `components/compiler-resolver.ts`, and `components/plugins/loader.ts` for the legacy path.
- **HTML, head or streaming output:** `runtime/server/renderer/{head,document,stream}.ts`.
- **Module author API:** `packages/kit/src`. Public exports come from `src/index.ts`. `@nuxt/kit/internal` is shared between first-party packages and is not public API.
- **A warning or error:** add it to a diagnostics catalog (`packages/kit/src/diagnostics` at build time, `packages/nuxt/src/app/diagnostics` in the app) rather than calling `console` directly.
- **What CI runs:** mostly the `package.json` scripts, called through `vp run <script>`; fixture suites run selected vitest projects directly. `ci-ok` is the single required check.
