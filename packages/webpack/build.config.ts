import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  declaration: true,
  entries: [
    'src/index',
    'src/loaders/nuxt-setup-loader'
  ],
  dependencies: [
    '@nuxt/kit',
    '@vue/compiler-sfc',
    '@vue/babel-preset-jsx',
    'postcss',
    'postcss-import-resolver',
    'postcss-loader',
    'babel-loader',
    'vue-loader',
    'css-loader',
    'file-loader',
    'style-resources-loader',
    'url-loader',
    'vue-style-loader',
    '@babel/core',
    'vue'
  ]
})
