# Progress

## 2026-03-17

- Added early stub generation in `packages/nitro-server/src/index.ts` to prevent resolve races for `#build/route-rules.mjs` and `#app-manifest` during early transform/build phases.
- Added regression coverage in `test/bundle.test.ts` to assert `.nuxt/route-rules.mjs` is generated after build.
- Validation: `pnpm vitest test/bundle.test.ts` was executed, but all tests in that file were skipped in this environment due existing skip guards (`isStubbed`/CI flags).
- Added a dedicated non-skipped integration test in `packages/nuxt/test/cache.test.ts` that verifies `route-rules.mjs` and app manifest meta output are generated with `experimental.appManifest: true`.
- Validation: `pnpm vitest run packages/nuxt/test/cache.test.ts --reporter=json --outputFile .test-cache-vitest.json` passed (4/4 tests).
- Added Vite hardening in `packages/vite/src/shared/client.ts` by explicitly excluding `#build/route-rules.mjs` from `optimizeDeps` pre-bundling.
- Added unit test `packages/vite/test/shared-client.test.ts` to lock the explicit optimizer excludes for `#build/route-rules.mjs` and `#app-manifest`.
- Validation: `pnpm vitest run packages/vite/test/shared-client.test.ts packages/vite/test/optimize-deps-hint.test.ts --reporter=json --outputFile .test-vite-hardening.json` passed (30/30 tests).
- Added fix for `defineAppConfig` under `future.compatibilityVersion: 5` by keeping internal Nitro imports enabled even when Nitro auto-import dirs/presets are disabled.
- Added regression test in `packages/nuxt/test/cache.test.ts` to verify build succeeds with `app/app.config.ts` using `defineAppConfig` and `future.compatibilityVersion: 5`.
- Refined the fix to a targeted Nitro rollup shim for app config files when `nitroAutoImports` is disabled, avoiding broader Nitro import side effects.
- Validation: `pnpm vitest run packages/nuxt/test/cache.test.ts --reporter=json --outputFile .test-cache-v5.json` passed (5/5 tests).
- Started issue `#34593`: improved `packages/vite/src/vite-node-runner.ts` error formatting to preserve original plugin error messages (`errorData.message`) and avoid noisy `undefined:undefined` location output.
- Added regression tests in `packages/vite/test/vite-node-runner.test.ts` for message preservation and location sanitization.
- Next: run targeted Vite tests for the new formatter behavior.
- Started issue `#34562`: added explicit `ComponentCustomProperties` typings for `$route`, `$router`, and `navigateTo` in `packages/nuxt/src/app/types/augments.ts` to harden Vue component-instance typing even when generated injection unions become large.
- Added fixture component `test/fixtures/basic-types/app/components/routing-instance-types.vue` that exercises `this.$route`, `this.$router`, and `this.navigateTo` in Options API style.
- Validation: `pnpm vitest run /home/josef/Projekte/Github/nuxt/test/typed-router.test.ts --root /home/josef/Projekte/Github/nuxt` passed (1/1 tests).
- Validation caveat: fixture-level `vue-tsc` in this local environment reports pre-existing workspace typing errors unrelated to these changes, so full `test:types` could not be used here as a clean signal.
- Started JavaScript-focused issue queue and implemented `#33033` (`ENOENT` on missing `*.js.map` requests).
- Added `isMissingSourceMapRequestError` guard in `packages/nitro-server/src/runtime/handlers/error.ts` to return HTTP 404 for missing sourcemap asset requests instead of surfacing a 500 crash.
- Added regression tests in `packages/nitro-server/test/error-handler.test.ts` covering ENOENT detection and early 404 response behavior.
- Validation: `pnpm vitest run /home/josef/Projekte/Github/nuxt/packages/nitro-server/test/error-handler.test.ts /home/josef/Projekte/Github/nuxt/packages/nitro-server/test/early-hints.test.ts --root /home/josef/Projekte/Github/nuxt` passed (6/6 tests).
