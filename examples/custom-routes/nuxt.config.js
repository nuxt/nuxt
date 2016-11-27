module.exports = {
  router: {
    routes: [
      { name: 'user', path: '/users/:id(\\d+)', component: 'pages/_user' }
    ]
  },
  build: {
    vendor: ['axios']
  }
}
