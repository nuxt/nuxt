const axios = require('axios')

module.exports = {
  env: {
    token: 'Hello :)',
    num: 3,
    bool: true
  },
  router: {
    routes: [
      { name: 'user', path: '/users/:id(\\d+)', component: 'pages/_user' }
    ]
  },
  build: {
    vendor: ['axios']
  },
  generate: {
    routeParams: {
      '/users/:id(\\d+)': function () {
        return axios.get('http://jsonplaceholder.typicode.com/users')
        .then((res) => {
          return res.data.map((user) => {
            return { id: user.id }
          })
        })
      }
    }
  }
}
