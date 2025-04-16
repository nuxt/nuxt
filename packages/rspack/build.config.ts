import { defineBuildConfig } from 'unbuild'
import { addRollupTimingsPlugin, stubOptions } from '../../debug/build-config'
import config from '../webpack/build.config'

export default defineBuildConfig({
  ...config[0],
  externals: [
    '@rspack/core',
    '#builder',
    '@nuxt/schema',
  ],
  stubOptions,
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
  ],
})
