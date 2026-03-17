# Progress

## 2026-03-17

- Added early stub generation in `packages/nitro-server/src/index.ts` to prevent resolve races for `#build/route-rules.mjs` and `#app-manifest` during early transform/build phases.
- Added regression coverage in `test/bundle.test.ts` to assert `.nuxt/route-rules.mjs` is generated after build.
- Validation: `pnpm vitest test/bundle.test.ts` was executed, but all tests in that file were skipped in this environment due existing skip guards (`isStubbed`/CI flags).
- Added a dedicated non-skipped integration test in `packages/nuxt/test/cache.test.ts` that verifies `route-rules.mjs` and app manifest meta output are generated with `experimental.appManifest: true`.
- Validation: `pnpm vitest run packages/nuxt/test/cache.test.ts --reporter=json --outputFile .test-cache-vitest.json` passed (4/4 tests).
- Added Vite hardening in `packages/vite/src/shared/client.ts` by explicitly excluding `#build/route-rules.mjs` from `optimizeDeps` pre-bundling.
- Added unit test `packages/vite/test/shared-client.test.ts` to lock the explicit optimizer excludes for `#build/route-rules.mjs` and `#app-manifest`.
- Next: run targeted Vite unit tests to validate the new hardening.
