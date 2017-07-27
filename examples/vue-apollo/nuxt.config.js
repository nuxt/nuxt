module.exports = {
  build: {
    vendor: ['vue-apollo', 'apollo-client']
  },
  plugins: [
    '~plugins/apollo.js',
  ]
}
