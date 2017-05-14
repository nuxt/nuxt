const path = require('path')

module.exports = function basicModule (options, resolve) {
  // Add  vendor
  this.addVendor('lodash')

  // Add a plugin
  this.addPlugin(path.resolve(__dirname, 'reverse.js'))

  resolve()
}
