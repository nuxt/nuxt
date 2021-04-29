const path = require('path')

module.exports = {
  purge: {
    enabled: true,
    content: [
      path.join(__dirname, './pages/**/*.vue'),
      path.join(__dirname, './layouts/**/*.vue'),
      path.join(__dirname, './components/**/*.vue')
    ],
    options: {
      whitelist: ['html', 'body', 'nuxt-progress']
    }
  },
  theme: {
    extend: {}
  },
  variants: {},
  plugins: []
}
