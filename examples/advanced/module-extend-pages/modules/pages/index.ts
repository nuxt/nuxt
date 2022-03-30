import { defineNuxtModule, extendPages } from '@nuxt/kit'
import { resolve } from 'pathe'

export default defineNuxtModule({
  setup () {
    extendPages((pages) => {
      // Add /test page
      pages.push({
        name: 'Test',
        path: '/test',
        file: resolve(__dirname, './pages/test.vue')
      })
    })
  }
})
