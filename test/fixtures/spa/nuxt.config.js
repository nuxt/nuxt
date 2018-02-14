module.exports = {
  mode: 'spa',
  dev: false,
  transition: false,
  render: {
    http2: {
      push: true
    }
  },
  build: {
    stats: false
  }
}
