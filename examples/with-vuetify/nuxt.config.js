
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
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css?family=Roboto' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/icon?family=Material+Icons' }
    ]
  }
}
