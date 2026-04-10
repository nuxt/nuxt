export default defineNuxtConfig({
  modules: [],
  devtools: { enabled: false },
  routeRules: {
    // Should accept any string
    '/named': { appMiddleware: 'named' },
  },
  experimental: { appManifest: true },
  compatibilityDate: 'latest',
  // @ts-expect-error Should show error on unknown properties
  unknownProp: '',
})
