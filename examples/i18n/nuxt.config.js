module.exports = {
  loading: {
    color: 'cyan'
  },
  router: {
    middleware: 'i18n'
  },
  build: {
    vendor: ['axios']
  },
  plugins: ['~plugins/i18n']
}
