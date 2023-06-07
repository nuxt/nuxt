const fetch = require('node-fetch-native')

export default {
  plugins: [
    '@/plugins/vue-placeholders.js'
  ],
  modules: [
    '@nuxt/http'
  ],
  generate: {
    async routes () {
      const posts = await fetch('https://jsonplaceholder.typicode.com/posts').then(res => res.json()).then(d => d.slice(0, 20))
      const routes = posts.map(post => `/posts/${post.id}`)

      return ['/'].concat(routes)
    }
  }
}
