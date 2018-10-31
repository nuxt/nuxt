export default {
  build: {
    modern: true,
    filenames: {
      app: ({ isModern }) => {
        return `${isModern ? 'modern-' : ''}[name].js`
      },
      chunk: ({ isModern }) => {
        return `${isModern ? 'modern-' : ''}[name].js`
      }
    }
  }
}
