import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index'
  ],
  dependencies: [
    '@nuxt/kit',
    'unplugin',
    'webpack-virtual-modules',
    'postcss',
    'postcss-loader',
    'vue-loader',
    'css-loader',
    'file-loader',
    'style-resources-loader',
    'url-loader',
    'vue'
  ],
  externals: [
    '@nuxt/schema'
  ]
})
