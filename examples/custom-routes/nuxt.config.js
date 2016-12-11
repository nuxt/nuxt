module.exports = {
  router: {
    // routes: [
    //   { name: 'post-slug', path: ':slug(\\d+)' }
    // ],
    routes: {
      comments: {
        _id: {
          regexp: ':id(\\d+)',
          generate: [1, 2, 3, 4] // Need to be finished on generate
        }
      },
      three: {
        _two: {
          regexp: ':two(\\d+)',
          one: {
            _id: {
              regexp: ':id(\\d+)'
            }
          }
        }
      }
    }
  },
  build: {
    vendor: ['axios']
  }
}
