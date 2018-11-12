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
  }
}
