export default {
  modern: true,
  build: {
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
    csp: true,
    crossorigin: 'use-credentials',
    http2: {
      push: true
    }
  }
}
