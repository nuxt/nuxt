export default {
  router: {
    base: '/test/'
  },
  dev: true, // Needed for __open-in-editor middleware
  debug: true,
  build: {
    stats: false
  },
  env: {
    'NODE_ENV': 'development'
  }
}
