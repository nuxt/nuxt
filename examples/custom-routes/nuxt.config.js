module.exports = {
  router: {
    routes: [
      { path: '/users/:id(\\d+)', component: 'pages/_user' }
    ]
  },
  build: {
    vendor: ['axios']
  }
}
