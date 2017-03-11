if (process.BROWSER_BUILD && process.env.NODE_ENV === 'production') {
  require('offline-plugin/runtime').install()
}
