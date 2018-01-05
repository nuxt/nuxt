module.exports = {
  dev: false,
  render: {
    resourceHints: false,
    http2: {
      push: true
    }
  },
  build: {
    stats: false,
    extractCSS: true
  }
}
