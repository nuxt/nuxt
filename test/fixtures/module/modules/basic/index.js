const path = require('path')

module.exports = function basicModule (options) {
  return new Promise((resolve, reject) => {
    // Add simple vendor
    this.addVendor('lodash')

    // Add a plugin
    this.addPlugin(path.resolve(__dirname, 'reverse.js'))

    // Add simple api endpoint
    this.addServerMiddleware({
      path: '/api',
      handler (req, res, next) {
        res.end('It works!')
      }
    })
    resolve()
  })
}
