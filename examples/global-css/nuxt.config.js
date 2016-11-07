const { resolve } = require('path')

module.exports = {
  css: [
    'hover.css/css/hover-min.css',
    { src: 'bulma', lang: 'sass' },
    resolve(__dirname, 'css/main.css')
  ]
}
