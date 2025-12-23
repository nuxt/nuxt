import { defineBuildConfig } from 'unbuild'
import { addRollupTimingsPlugin } from '../../debug/build-config.ts'
import config from '../webpack/build.config.ts'

export default defineBuildConfig({
  ...config[0],
  externals: [
    '@rspack/core',
    '#builder',
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
  ],
})
