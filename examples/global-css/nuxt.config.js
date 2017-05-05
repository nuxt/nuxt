const { join } = require('path')

module.exports = {
  css: [
    'hover.css/css/hover-min.css',
    'bulma/bulma.sass',
    join(__dirname, 'css/main.css')
  ],
  build: {
    extractCSS: true
  }
}
