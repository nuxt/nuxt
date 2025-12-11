import { defineBuildConfig } from 'unbuild'
import { addRollupTimingsPlugin } from '../../debug/build-config.ts'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
    { input: 'src/runtime/', outDir: 'dist/runtime', ext: 'js' },
  ],
  hooks: {
    'rollup:options' (ctx, options) {
      addRollupTimingsPlugin(options)
    },
  },
  externals: [
    '@nuxt/schema',
    'nuxt',
    'nitropack',
  ],
})
