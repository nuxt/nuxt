export default defineNuxtConfig({
  modules: [],
  devtools: { enabled: false },
  routeRules: {
    // Should accept any string
    '/named': { appMiddleware: 'named' },
  },
  experimental: { appManifest: true },
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
  // @ts-expect-error Should show error on unknown properties
  unknownProp: '',
})
