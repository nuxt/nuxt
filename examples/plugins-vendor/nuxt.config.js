module.exports = {
  build: {
    vendor: ['axios', 'mini-toastr', 'vue-notifications']
  },
  plugins: [
    // ssr: false to only include it on client-side
    { src: '~/plugins/vue-notifications.js', ssr: false }
  ]
}
