/*!
 * Nuxt.js
 * (c) 2016-2018 Chopin Brothers
 * Core maintainers: Pooya Parsa (@pi0) - Clark Du (@clarkdo)
 * Released under the MIT License.
 */

const fs = require('fs')
const path = require('path')
const semver = require('semver')

const { engines } = require('./package.json')

if (!semver.satisfies(process.version, engines.node)) {
  // Auto fallback to legacy build on older node versions
  module.exports = require('./dist/nuxt-legacy.js')
} else if (fs.existsSync(path.resolve(__dirname, '.babelrc'))) {
  // Use esm version when using linked repository to prevent builds
  module.exports = require('./lib/index.js')
} else {
  // Use production bundle by default
  module.exports = require('./dist/nuxt.js')
}
