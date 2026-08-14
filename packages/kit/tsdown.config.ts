import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/internal/index.ts'],
  alias: {
    'pkg-types': fileURLToPath(new URL('src/internal/package-json.ts', import.meta.url)),
  },
  // No `oxc: true`: it can't infer `defineDiagnostics()`'s return type, which the
  // diagnostics catalogs rely on. tsc handles it.
  dts: {},
  exports: { devExports: true },
  deps: {
    // like nitro, we inline `c12` because we don't want to pull in chokidar and other deps we don't use.
    //
    // `untyped` is inlined because only `applyDefaults` is used, and its package pulls in `jiti`
    // for a loader entry point Nuxt never imports.
    onlyBundle: ['c12', 'untyped', 'pkg-types'],
    neverBundle: [
      // Optional peers the inlined `c12` reaches for with a dynamic import, and only for projects
      // that need them: remote layers, and `.env` files on runtimes without `util.parseEnv`.
      'giget',
      'dotenv',
      'jiti',
      '@nuxt/schema',
      'nitro/types',
      'nitropack/types',
      /^rolldown(\/|$)/,
      'oxc-parser',
      'mlly',
      /^nuxt(\/|$)/,
      /^#build\//,
      /^#internal\//,
    ],
  },
})
