const { join } = require('path')

module.exports = {
  vendor: ['axios', 'vee-validate'],
  plugins: [ join(__dirname, './plugins/vee-validate.js') ]
}
