if (process.env.NODE_ENV === 'production') {
  var OfflinePlugin = require('offline-plugin/runtime')
  window.onNuxtReady(() => {
    OfflinePlugin.install({
      onInstalled: function () {
        console.log('Offline plugin installed.') // eslint-disable-line no-console
      },
      onUpdating: function () {

      },
      onUpdateReady: function () {
        OfflinePlugin.applyUpdate()
      },
      onUpdated: function () {
        window.location.reload()
      }
    })
  })
}
