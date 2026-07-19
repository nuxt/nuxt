import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    dts: { oxc: true },
    exports: { devExports: true },
    entry: ['src/index.ts', 'src/h3.ts', 'src/augments.ts'],
    deps: {
      onlyBundle: [],
      neverBundle: ['@nuxt/schema', '#app/types'],
    },
  },
  {
    dts: false,
    outDir: 'dist/runtime/',
    entry: 'src/runtime/**/*',
    unbundle: true,
    deps: {
      onlyBundle: [],
      neverBundle: [
        '#build/dist/server/client.precomputed.mjs',
        '#build/dist/server/client.manifest.mjs',
        '#build/dist/server/styles.mjs',
        '#build/dist/server/server.mjs',
        '#internal/nuxt/paths',
        '#internal/dev-server-logs-options',
        '#internal/entry-chunk.mjs',
        '#internal/nuxt.config.mjs',
        '#internal/nuxt/app-config',
        '#internal/nuxt/entry-ids.mjs',
        '#internal/nuxt/nitro-config.mjs',
        '#internal/unhead.config.mjs',
        '#internal/unhead-options.mjs',
        '#spa-template',
      ],
    },
  },
])
