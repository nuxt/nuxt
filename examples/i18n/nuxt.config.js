module.exports = {
  build: {
    vendor: ['vue-i18n']
  },
  router: {
    middleware: 'i18n'
  },
  plugins: [
    // Will inject the plugin in the $root app and also in the context as `i18n`
    { src: '~plugins/i18n.js', injectAs: 'i18n' }
  ],
  generate: {
    routes: ['/', '/about', '/fr', '/fr/about']
  },
  loading: { color: 'cyan' },
}
