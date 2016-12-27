module.exports = {
  router: {
    base: '/test/'
  },
  cache: true,
  plugins: ['~plugins/test.js'],
  loading: '~components/loading',
  env: {
    bool: true,
    num: 23,
    string: 'Nuxt.js'
  },
  extend (config, options) {
    config.devtool = 'eval-source-map'
  }
}
