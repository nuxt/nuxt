import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: { generator: 'oxc' },
  entry: ['src/index.ts', 'src/loaders/vue-module-identifier.ts'],
  deps: {
    onlyBundle: [],
    neverBundle: true,
  },
})
