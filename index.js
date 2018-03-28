/*!
 * Nuxt.js
 * (c) 2016-2018 Chopin Brothers
 * Core maintainers: Pooya Parsa (@pi0) - Clark Du (@clarkdo)
 * Released under the MIT License.
 */

const fs = require('fs')
const path = require('path')

if (fs.existsSync(path.resolve(__dirname, '.babelrc'))) {
  module.exports = require('./lib/index.js')
} else {
  module.exports = require('./dist/nuxt.js')
}
