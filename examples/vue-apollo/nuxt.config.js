module.exports = {
  build: {
    vendor: ['vue-apollo', 'apollo-client']
  },
  router: {
    middleware: 'apollo'
  },
  plugins: [
    // Will inject the plugin in the $root app and also in the context as `i18n`
    { src: '~plugins/apollo.js', injectAs: 'apolloProvider' }
  ]
}
