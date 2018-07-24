export default {
  mode: 'spa',
  transition: false,
  render: {
    http2: {
      push: !process.env.APPVEYOR
    }
  }
}
