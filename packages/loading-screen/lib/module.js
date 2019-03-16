const LoadingUI = require('./loading')

module.exports = async function () {
  const loading = new LoadingUI(this.nuxt)

  await loading.init()

  this.addServerMiddleware({
    path: '/_loading',
    handler: loading.app
  })
}
