module.exports = {
  head: {
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width,minimum-scale=1' }
    ]
  },
  mode: 'ssr',
  render: {
    resourceHints: false
  },
  loading: false
}
