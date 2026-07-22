import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: { oxc: true },
  entry: ['src/index.ts', 'src/builder-env.ts'],
  exports: { devExports: true },
  deps: {
    skipNodeModulesBundle: true,
    onlyBundle: [],
    neverBundle: [
      'nuxt/app',
      'pug',
    ],
  },
})
