
const { join } = require('path')

module.exports = {
  build: {
    vendor: ['vuetify']
  },
  plugins: ['~plugins/vuetify.js'],
  css: [
    { src: join(__dirname, 'css/app.styl'), lang: 'styl' }
  ],
  head: {
    link: [
      { rel: 'preload', as: 'style', href: 'https://fonts.googleapis.com/css?family=Roboto' }
    ]
  }
}
