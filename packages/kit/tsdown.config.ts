import { defineConfig } from 'tsdown'

export default defineConfig({
  // No `oxc: true`: it can't infer `defineDiagnostics()`'s return type, which the
  // diagnostics catalogs rely on. tsc handles it.
  dts: {},
  exports: { devExports: true },
  deps: {
    onlyBundle: [],
    neverBundle: [
      '@nuxt/schema',
      'nitro/types',
      'nitropack/types',
      'webpack',
      'vite',
      'unimport',
      /^nuxt(\/|$)/,
      /^#build\//,
      /^#internal\//,
    ],
  },
})
