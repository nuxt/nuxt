export default {
  modern: true,
  build: {
    filenames: {
      app: ({ isModern }) => `[name]${isModern ? '.modern' : ''}.js`,
      chunk: ({ isModern }) => `[name]${isModern ? '.modern' : ''}.js`
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
