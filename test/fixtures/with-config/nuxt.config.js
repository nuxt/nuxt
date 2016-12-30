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
  build: {
    extend (config, options) {
      config.devtool = 'nosources-source-map'
    }
  }
}
