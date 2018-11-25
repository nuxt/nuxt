export default {
  mode: 'spa',
  transition: false,
  render: {
    http2: {
      push: true
    },
    bundleRenderer: {
      shouldPrefetch: () => true
    }
  },
  build: {
    filenames: {
      app: '[name].js',
      chunk: '[name].js'
    }
  },
  plugins: [
    '~/plugins/error.js'
  ]
}
