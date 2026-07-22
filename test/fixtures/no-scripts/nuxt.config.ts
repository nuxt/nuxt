export default defineNuxtConfig({
  devtools: { enabled: false },
  routeRules: {
    '/no-scripts': { noScripts: true },
    '/no-scripts/**': { noScripts: true },
    // canonical path is served without scripts, but the `/aliased-alt` alias is not
    '/aliased': { noScripts: true },
    '/products/**': { noScripts: true },
    '/dash/**': { noScripts: true },
    '/report': { noScripts: true },
  },
  experimental: {
    viewTransition: true,
  },
  compatibilityDate: 'latest',
})
