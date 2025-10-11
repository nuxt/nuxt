import { defineBuildConfig } from 'unbuild'
import { addRollupTimingsPlugin, stubOptions } from '../../debug/build-config'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
  ],
  rollup: {
    inlineDependencies: ['lodash-es'],
  },
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
    'webpack',
    'vite',
    'h3',
    'unimport',
  ],
})
