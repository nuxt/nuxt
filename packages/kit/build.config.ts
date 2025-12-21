import { defineBuildConfig } from 'unbuild'
import { addRollupTimingsPlugin } from '../../debug/build-config.ts'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
  ],
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
