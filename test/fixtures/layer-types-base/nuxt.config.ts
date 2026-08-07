export default defineNuxtConfig({
  extends: ['../layer-types-nested'],
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
