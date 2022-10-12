export default defineNuxtConfig({
  extends: '@nuxt-themes/website',
  nitro: {
    prerender: {
      routes: ['/', '/404.html', '/guide/directory-structure/app.config']
    }
  }
})
