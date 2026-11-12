import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: { generator: 'oxc' },
  entry: ['src/index.ts'],
  deps: {
    onlyBundle: [],
    neverBundle: true,
  },
})
