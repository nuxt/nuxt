import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: { generator: 'oxc' },
  entry: ['src/index.ts', 'src/builder-env.ts', 'src/internal.ts'],
  exports: { devExports: true },
  deps: {
    onlyBundle: [],
    neverBundle: true,
  },
})
