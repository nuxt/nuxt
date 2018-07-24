export default {
  render: {
    resourceHints: false,
    http2: {
      push: !process.env.APPVEYOR
    }
  }
}
