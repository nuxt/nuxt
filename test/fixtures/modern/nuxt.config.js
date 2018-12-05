export default {
  modern: true,
  build: {
    crossorigin: 'use-credentials',
    filenames: {
      app: ({ isModern }) => {
        return `${isModern ? 'modern-' : ''}[name].js`
      },
      chunk: ({ isModern }) => {
        return `${isModern ? 'modern-' : ''}[name].js`
      }
    }
  },
  render: {
    http2: {
      push: true
    }
  }
}
