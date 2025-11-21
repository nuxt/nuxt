import { defineBuildConfig } from 'unbuild'
import { addRollupTimingsPlugin, stubOptions } from '../../debug/build-config'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
  ],
  stubOptions,
  hooks: {
    'rollup:options' (ctx, options) {
      addRollupTimingsPlugin(options)
    },
  },
  externals: [
    '@rspack/core',
    '@nuxt/schema',
    'nitropack',
    'nitro',
    'webpack',
    'vite',
    'h3',
    'unimport',
  ],
})
