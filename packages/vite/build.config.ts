import { defineBuildConfig } from 'unbuild'
import { addRollupTimingsPlugin } from '../../debug/build-config.ts'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
    { input: 'src/runtime/', outDir: 'dist/runtime', format: 'esm' },
  ],
  hooks: {
    'rollup:options' (ctx, options) {
      addRollupTimingsPlugin(options)
    },
  },
  dependencies: [
    'vue',
  ],
  externals: [
    '@nuxt/schema',
  ],
})
