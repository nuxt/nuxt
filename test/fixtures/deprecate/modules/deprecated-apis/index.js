module.exports = function basicModule(options, resolve) {
  this.addVendor('lodash')
  resolve()
}
