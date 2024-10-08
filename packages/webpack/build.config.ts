import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
  ],
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
