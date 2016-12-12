module.exports = {
  build: {
    vendor: ['axios']
  },
  generate: {
    routeParams: {
      '/users/:id': [{id: 1}, {id: 2}, {id: 3}, {id: 4}, {id: 5}],
      '/posts/:slug': [{slug: 'welcome'}, {slug: 'foo'}, {slug: 'bar'}],
      '/posts/:slug/comments': [{slug: 'welcome'}, {slug: 'foo'}, {slug: 'bar'}],
      '/posts/:slug/:name': [{slug: 'welcome', name: 'a'}, {slug: 'foo', name: 'b'}, {slug: 'bar', name: 'a'}],
      '/projects/:slug': [{slug: 'toto'}, {slug: 'titi'}, {slug: 'tutu'}]
    }
  }
}
