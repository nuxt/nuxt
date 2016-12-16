module.exports = {
  build: {
    vendor: ['axios']
  },
  generate: {
    routeParams: {
      '/users/:id': [{id: 1}, {id: 2}, {id: 3}, {id: 4}, {id: 5}],
      '/posts/:slug': [{slug: 'foo'}, {slug: 'bar'}],
      '/posts/:slug/comments': [{slug: 'foo'}, {slug: 'bar'}],
      '/posts/:slug/:name': [{slug: 'foo', name: 'b'}, {slug: 'bar', name: 'a'}],
      '/projects/:slug': [{slug: 'toto'}, {slug: 'titi'}, {slug: 'tutu'}]
    }
  },
  transition: 'fade',
  loading: false
}
