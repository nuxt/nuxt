import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: { oxc: true },
  entry: ['src/index.ts', 'src/loaders/vue-module-identifier.ts'],
  deps: {
    skipNodeModulesBundle: true,
    onlyBundle: [],
    neverBundle: [
      '@nuxt/schema',
      '#builder',
    ],
  },
})
