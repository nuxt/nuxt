const { join } = require('path')

module.exports = {
  vendor: ['axios', 'mini-toastr', 'vue-notifications'],
  plugins: [ join(__dirname, './plugins/vue-notifications.js') ]
}
