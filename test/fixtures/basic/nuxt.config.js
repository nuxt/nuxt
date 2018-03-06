const path = require('path')

module.exports = {
  pageExtensions: ['js', 'vue', 'md'],
  generate: {
    routes: [
      '/users/1',
      '/users/2',
      { route: '/users/3', payload: { id: 3000 } }
    ],
    interval: 200,
    subFolders: true
  },
  modulesDir: path.join(__dirname, '..', '..', '..', 'node_modules'),
  hooks: {
    ready(nuxt) {
      nuxt.__hook_called__ = true
    },
    bad: null,
    '': true
  },
  transition: false,
  build: {
    scopeHoisting: true,
    postcss: [require('postcss-cssnext')()]
  }
}
