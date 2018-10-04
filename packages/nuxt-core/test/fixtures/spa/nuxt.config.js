export default {
  mode: 'spa',
  transition: false,
  render: {
    http2: {
      push: true
    }
  },
  plugins: [
    '~/plugins/error.js'
  ]
}
