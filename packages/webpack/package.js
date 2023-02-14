export default {
  build: true,
  externals: [
    'webpack/lib/util/objectToMap'
  ],
  ignoreUnused: [
    '@nuxt/babel-preset-app',
    '@babel/core', // peerDependency of babel-loader
    'babel-loader',
    'cache-loader',
    'caniuse-lite',
    'css-loader',
    'cssnano',
    'eventsource-polyfill',
    'file-loader',
    'postcss-loader',
    'postcss-preset-env',
    'postcss-url',
    'style-resources-loader',
    'vue-style-loader', // vue-loader
    'vue-template-compiler', // vue-loader
    'url-loader'
  ]
}
