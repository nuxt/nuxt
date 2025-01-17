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
  dependencies: [
    '@nuxt/kit',
    'unplugin',
    'postcss',
    'postcss-loader',
    'vue-loader',
    'css-loader',
    'file-loader',
    'url-loader',
    'vue',
  ],
  externals: [
    '#builder',
    '@nuxt/schema',
  ],
})
