module.exports = {
  loading: {
    color: 'cyan'
  },
  router: {
    middleware: 'i18n'
  },
  build: {
    vendor: ['vue-i18n']
  },
  plugins: [
    { src: '~plugins/i18n.js', injectAs: 'i18n' }
  ]
}
