export default defineNuxtConfig({
  vite: {
    vue: {
      template: {
        transformAssetUrls: {
          BImg: ['src']
        }
      }
    }
  }
})
