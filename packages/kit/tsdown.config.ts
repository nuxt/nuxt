import { defineConfig } from 'tsdown'

export default defineConfig({
  // NOTE: tsc-backed dts (not `oxc: true`) so the diagnostics catalogs can keep
  // their inline `defineDiagnostics()` form. oxc's isolated-declarations transform
  // can't infer that generic return type and would force explicit annotations on
  // every catalog; tsc resolves it. See #35179 for the repo-wide oxc default.
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
