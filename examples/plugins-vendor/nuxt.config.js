const { join } = require('path')

module.exports = {
  build: {
    vendor: ['axios', 'mini-toastr', 'vue-notifications']
  },
  plugins: [ join(__dirname, './plugins/vue-notifications.js') ]
}
