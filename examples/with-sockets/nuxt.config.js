module.exports = {
  build: {
    vendor: ['socket.io-client']
  },
  head: {
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' }
    ]
  },
  env: {
    HOST_URL: process.env.HOST_URL || 'http://localhost:3000'
  }
}
