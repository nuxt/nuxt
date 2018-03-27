/*!
 * Nuxt.js
 * (c) 2016-2018 Chopin Brothers
 * Core maintainers: Pooya Parsa (@pi0) - Clark Du (@clarkdo)
 * Released under the MIT License.
 */

const fs = require('fs')

if (fs.existsSync('dist/nuxt.js')) {
  module.exports = require('./dist/nuxt.js')
} else {
  module.exports = require('./lib/index.js')
}
