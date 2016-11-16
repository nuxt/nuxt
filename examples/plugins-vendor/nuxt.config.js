module.exports = {
  build: {
    vendor: ['axios', 'mini-toastr', 'vue-notifications']
  },
  plugins: [
    '~plugins/vue-notifications.js'
  ]
}
