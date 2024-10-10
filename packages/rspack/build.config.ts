import { defineBuildConfig } from 'unbuild'
import config from '../webpack/build.config'

export default defineBuildConfig({
  ...config[0],
  externals: [
    '@rspack/core',
    '#builder',
    '@nuxt/schema',
  ],
  entries: [
    {
      input: '../webpack/src/index',
      name: 'index',
      declaration: true,
    },
  ],
})
