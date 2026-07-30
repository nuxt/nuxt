# `nuxt dev` performance: findings

Record of the July 2026 dev-performance cycle. Kept for the next one: the
baselines are a starting point, the negative results are there so nobody
re-runs them, and the open items are the backlog.

See `README.md` for the harness and the methodology rules.

## Baselines before the cycle

Medium and large synthetic fixtures, Nuxt `5.0.0-0`, Nitro `3.0.260610-beta`,
Vite `8.1.5`, Vue `3.5.40`, default configuration. Machine-dependent; re-measure
rather than comparing against these directly.

| Metric | medium | large |
| --- | --- | --- |
| `coldReady` | 2985 ms | 3903 ms |
| `warmReady` | 2505 ms | 3834 ms |
| `firstSSR` | 289 ms | 340 ms |
| `warmSSR` | 6 ms | 6 ms |
| `coldRouteSSR` | 176 ms | 287 ms |
| `firstClientLoad` | 2639 ms | 9769 ms |
| `warmClientLoad` | 1270 ms | 3525 ms |
| `clientModules` | 560 | 1602 |
| `clientBytes` | 9.0 MB | 22.8 MB |
| `hmrServer` | 75 ms | 150 ms |
| `hmrPage` | 82 ms | 223 ms |
| `addComponent` | 116 ms | 339 ms |
| `hmrServerRoute` | 229 ms | 487 ms |
| `restart` | 1429 ms | 3450 ms |
| `rss` | 988 MB | 1502 MB |

The three signals that drove everything else:

1. **`warmReady` was within a few percent of `coldReady`.** Restarting the dev
   server saved nothing.
2. **`firstClientLoad` was 9.8 seconds on a large app**, and 3.5s even with every
   transform cached, so it was a serving and module-count cost rather than a
   compilation cost.
3. **`rss` was 988 MB for a medium synthetic app** with no real dependencies, and
   adding 40 trivial CJS deps moved it to 1139 MB.

## What landed

In `nuxt/nuxt`:

| | |
| --- | --- |
| #35887 | handle missed chokidar watch events |
| #35888 | call `nitro:build:before` in nitro vite environment |
| #35890 | write app manifest when nitro runs as a vite environment |
| #35900 | start client warmup when nitro runs as a vite environment |
| #35901 | use lazy imports to improve parsing speed |
| #35902 | skip rewriting unchanged generated files |
| #35912 | reuse app and component scans for unchanged structures |
| (direct) | keep scanning user server auto-import dirs when nitro presets are off |
| (direct) | lazily import `consola` and `devalue` in dev-server-logs |
| (direct) | load `untyped/babel-plugin` only when a schema file exists |
| (direct) | report template generation timings with `debug.templates` |

Landed separately and shaped this work: #35875 (templates declare dependencies),
#35869 (page meta extraction), #35870 (crawl client module graph when warming).

In `nuxt/cli`: #1411 disables mimalloc eager arena commit at the CLI entry, which
is the correct home for it, since it has to run before any native addon loads.

Combined effect measured on the integrated tree before upstreaming: `rss` -46%,
`hmrServerRoute` -92%, `hmrServer` -53%, `hmrPage` -46%, `addComponent` -29%,
cold start -12 to -16%.

## Correctness bugs found while benchmarking

None of these were performance problems; all were found by building a realistic
fixture and exercising it.

- **Server auto-imports were entirely broken**, in production builds as well as
  dev. `experimental.nitroAutoImports` defaulting to `false` under compatibility
  version 5 collapsed the whole `nitro.imports` config, killing user
  `server/utils` and `shared/utils` auto-imports, `server/types` scanning, Nuxt's
  own internal imports, and all of `nitro-imports.d.ts`. No test caught it because
  the `basic` fixture sets the flag to `true`.
- **chokidar v3 silently drops rapid saves.** The copy Vite bundles discards any
  `change` event arriving within 50ms of the previous change to the same file and
  never replays it, so a quick second save is simply lost. Nuxt itself is on
  chokidar 5. This also meant part of the original HMR baseline was measuring the
  throttle rather than Nuxt.
- **`nitro:build:before` never fired** when Nitro ran as a Vite environment, so
  `experimental.buildCache`, Nitro type paths, decorators and the pages hook were
  all silently dead on that path.
- **The app manifest's `latest.json` was never written** on the env API path.
- **`pnpm test:e2e:dev` cannot pass locally.** The `@nuxt/cli` dev lock is keyed
  on `rootDir` only, so parallel Playwright workers using the same fixture kill
  each other. CI is green only because it pins `workers: 1`.

## Negative results

Do not redo these without new information.

**Removing Nuxt's `optimizeDeps` exclusion list changes nothing.** It was reported
as -46% cold start; on an uncontended machine it was 2525ms versus 2497ms, medians
of five, with the client graph unchanged at 484 modules. Forcing the same packages
through `optimizeDeps.include` also leaves the graph unchanged: Vite 8 declines to
prebundle these already-ESM packages either way. The list is inert in both
directions, so removing it trades away singleton-identity protection for nothing.

**Stubbing `h3` and `@vue/devtools-api` on the client breaks islands.** It is the
biggest available payload win, about 1.5MB, and it takes
`test/server-components.test.ts` from 40 passing to 12 failing, every failure a
`renderPage` timeout because the client bundle never hydrates. The underlying
problem is real (see open items) but needs a narrower cut.

**Warming the SSR graph as soon as the Vite server exists makes things worse.**
There is no idle main-thread time during a cold start. It blew Nitro's build from
196ms to 1810ms and pushed time-to-first-response from 2364ms to 3918ms. Note this
is the *SSR* graph; warming the *client* graph after Nitro builds is what #35870
does, and that works.

**A vite-node transform cache cannot be ported to the Nitro Vite environment.**
Persisting vite-node's `fetchModule` responses is worth `warmReady` -31% and
`warmFirstSSR` -79% on the legacy path. The env API path externalizes almost
everything to native ESM and pushes only about 31 modules through Vite, so there
is nothing left to cache. Wrapping `transformRequest` to serve from cache
regressed warm start from ~2.5s to ~60s, because the module runner depends on
Vite's module graph being updated during transform. This would need Vite to expose
a persistent module graph API.

**`experimental.externalizeDevDependencies` was inconclusive** and was not shipped.

## Open items

1. **`experimental.nitroViteEnvironment` should become the v5 default.** Measured
   at cold start -16%, `rss` -32%, `hmrServerRoute` -89%, `restart` -14%,
   `warmReady` -17% relative to the legacy path. The warmup interaction that
   blocked it is fixed by #35900. Remaining known wart: `hmrStyle` regressed 16ms
   to 39ms on that path, the only inner-loop metric that moves the wrong way.
2. **`extractSerializablePageMeta`**, rebuilt on top of #35869's
   extract/dynamic/reshape taxonomy to extract any serializable property rather
   than only the listed keys, including statically-known `layout: { name, props }`
   reshapes. Not upstreamed. This is the riskiest of the outstanding changes:
   static extraction has to mirror every key the macro transform reshapes.
3. **Reuse the page tree and contents cache on page edits**, so a content change
   re-emits routes from the existing tree instead of re-globbing every layer's
   pages directory. Not upstreamed.
4. **The server auto-imports regression test and fixture did not land** with the
   fix. Without it the bug can come back exactly as before.
5. **The `@nuxt/cli` dev-lock design.** The `NUXT_IGNORE_LOCK` workaround unblocks
   local `test:e2e:dev`, but the lock being keyed on `rootDir` alone is the actual
   problem.
6. **`app/composables/error.ts` still pulls all of `h3` and `rou3` (~570 KB) into
   the browser** via `@nuxt/nitro-server`'s h3 re-export. Needs a narrower cut than
   aliasing h3 wholesale, and it is worth checking whether it also affects the
   production client bundle.
7. **chokidar's dropped-change bug belongs upstream in Vite.** #35887 works around
   it inside Nuxt.
8. **`experimental.watcher: 'builder'` beat every alternative** on every
   inner-loop metric plus 10-15% on memory, while the current default
   `chokidar-granular` carried a +155% restart cost. Wants re-measuring on top of
   #35875 before changing a default.
9. **The memory win is Linux-specific and unverified for `nuxt build`.** Its size
   depends on transparent huge pages backing mimalloc's arena commits. Needs a
   macOS number.
10. **`clientModules` is still ~560 for a single page.** `optimizeDeps` is not the
    lever (see negative results). Reducing it means shipping less dev-mode ESM.
11. **Two rolldown native bindings load at once**, because Nitro allows `^1.1.0`
    while Vite pins `~1.1.5`.
12. **`sourcemap: { server: false }` removes ~100 MB**; rendering every route
    costs roughly 2 MB per route of native SSR sourcemap churn.
13. **Dependency modules could be served immutably.** Dev modules are served
    `Cache-Control: no-cache` with a weak ETag; dependency URLs already carry a
    content hash (`?v=<hash>`).
