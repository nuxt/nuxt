export default defineNuxtConfig({
  nitro: {
    routeRules: {
      '/static': {
        prerender: true,
      },
    },
  },
})
