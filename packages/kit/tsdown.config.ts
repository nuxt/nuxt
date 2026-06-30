import { defineConfig } from 'tsdown'

export default defineConfig({
  // No `oxc: true`: it can't infer `defineDiagnostics()`'s return type, which the
  // diagnostics catalogs rely on. tsc handles it.
  dts: {},
  exports: { devExports: true },
  deps: {
    onlyBundle: [],
    neverBundle: [
      '@rspack/core',
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
