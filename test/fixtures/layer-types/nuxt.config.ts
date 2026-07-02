export default defineNuxtConfig({
  extends: ['../layer-types-base'],
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
