import { defineBuildConfig } from 'unbuild'
import { addRollupTimingsPlugin } from '../../debug/build-config.ts'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
  ],
  rollup: {
    inlineDependencies: ['lodash-es'],
  },
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
