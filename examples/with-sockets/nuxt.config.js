module.exports = {
  head: {
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' }
    ]
  },
  modules: ['~/io'],
  env: {
    WS_URL: process.env.WS_URL || 'http://localhost:3000'
  }
}
