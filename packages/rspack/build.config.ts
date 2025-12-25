import { defineBuildConfig } from 'unbuild'
import { addRollupTimingsPlugin } from '../../debug/build-config.ts'
import config from '../webpack/build.config.ts'

export default defineBuildConfig({
  ...config[0],
  externals: [
    '@rspack/core',
    '#builder',
    'webpack', /* types - unbuild bug */
    '@nuxt/schema',
  ],
  hooks: {
    'rollup:options' (ctx, options) {
      addRollupTimingsPlugin(options)
    },
  },
  entries: [
    {
      input: '../webpack/src/index',
      name: 'index',
      declaration: true,
    },
    {
      input: '../webpack/src/loaders/vue-module-identifier',
      name: 'loaders/vue-module-identifier',
      declaration: false,
    },
  ],
})
