export default defineNuxtConfig({
  modules: [
    '@nuxt/ui'
  ],
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
