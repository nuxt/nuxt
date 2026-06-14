import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: { oxc: true },
  entry: ['src/index.ts'],
  deps: {
    skipNodeModulesBundle: true,
    onlyBundle: [],
    neverBundle: [
      '@nuxt/schema',
      '@nasti-toolchain/nasti',
    ],
  },
})
