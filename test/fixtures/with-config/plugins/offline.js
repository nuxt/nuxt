if (process.env.NODE_ENV === 'production') {
  var OfflinePlugin = require('offline-plugin/runtime')
  OfflinePlugin.install()
}
