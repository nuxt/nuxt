module.exports = {
  router: {
    base: '/test/'
  },
  dev: true, // Needed for __open-in-editor middleware
  debug: true,
  editor: {
    cmd: 'echo',
    pattern: ''
  },
  build: {
    stats: false
  }
}
