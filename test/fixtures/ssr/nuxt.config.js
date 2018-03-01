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
    extractCSS: false // https://github.com/webpack/webpack/pull/6597
  }
}
