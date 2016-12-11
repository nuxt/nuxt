module.exports = {
  router: {
    routes: {
      author: {
        alias: '/nuxt'
      },
      users: {
        _id: {
          regexp: ':id(\\d+)'
          // generate: [1, 2, 3, 4] // Need to be finished on generate
        }
      },
      posts: {
        alias: '/articles'
      }
    }
  },
  // generate: {
  //   routeParams: {
  //     '/guide/:slug': _(require('./static/docs/guide/menu.json')).values().flatten().map('to').compact().map((slug) => { return { slug: slug.replace(/^\//, '') } }).value(),
  //     '/api/:slug': _(require('./static/docs/api/menu.json')).values().flatten().map('to').compact().map((slug) => { return { slug: slug.replace(/^\//, '') } }).value(),
  //     '/examples/:slug': _(require('./static/docs/examples/menu.json')).values().flatten().map('to').compact().map((slug) => { return { slug: slug.replace(/^\//, '') } }).value()
  //   }
  // },
  build: {
    vendor: ['axios']
  }
}
