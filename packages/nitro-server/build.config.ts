import { defineBuildConfig } from 'unbuild'
import { addRollupTimingsPlugin, stubOptions } from '../../debug/build-config'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
    { input: 'src/runtime/', outDir: 'dist/runtime', ext: 'js' },
  ],
  stubOptions,
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
