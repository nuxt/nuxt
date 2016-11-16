const { join } = require('path')

module.exports = {
  css: [
    'hover.css/css/hover-min.css',
    { src: 'bulma', lang: 'sass' },
    join(__dirname, 'css/main.css')
  ]
}
