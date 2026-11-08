import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: { generator: 'oxc' },
  entry: ['src/index.ts', 'src/builder-env.ts', 'src/internal.ts'],
  exports: { devExports: true },
  deps: {
    onlyBundle: ['untyped'],
    neverBundle: true,
    // `untyped` is inlined into `nuxt` and `@nuxt/kit` rather than installed, so its types ship here.
    dts: { alwaysBundle: ['untyped'] },
  },
})
