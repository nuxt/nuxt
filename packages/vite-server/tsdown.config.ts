import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    dts: { generator: 'oxc' },
    entry: ['src/index.ts'],
    deps: {
      onlyBundle: [],
      neverBundle: ['@nuxt/schema'],
    },
  },
  {
    dts: false,
    outDir: 'dist/runtime/',
    entry: 'src/runtime/**/*',
    unbundle: true,
    deps: {
      onlyBundle: [],
      neverBundle: [],
    },
  },
])
