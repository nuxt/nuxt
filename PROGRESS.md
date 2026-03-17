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
