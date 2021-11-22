import { defineNuxtConfig } from 'nuxt3'

export default defineNuxtConfig({
  components: {
    dirs: [
      '~/components',
      {
        path: '~/other-components-folder',
        extensions: ['vue'],
        prefix: 'nuxt'
      }
    ]
  }
})
