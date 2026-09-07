import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    dts: { generator: 'oxc' },
    exports: { devExports: true },
    entry: ['src/index.ts', 'src/h3.ts', 'src/augments.ts', 'src/request-types.ts'],
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
        '#internal/nuxt/paths',
        '#internal/dev-server-logs-options',
        '#internal/nuxt.config.mjs',
        '#internal/nuxt/app-config',
        '#internal/nuxt/nitro-config.mjs',
      ],
    },
  },
])
