export default defineNuxtConfig({
  compatibilityDate: 'latest',
  nitro: {
    typescript: {
      tsConfig: {
        compilerOptions: {
          paths: {
            '#app/internal/*': ['../../../../packages/nuxt/dist/app/internal/*'],
          },
        },
      },
    },
  },
})
