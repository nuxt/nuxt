export default defineNuxtConfig({
  extends: ['../route-scroll'],
  routeRules: {
    '/big-page-2': { ssr: false },
    '/nested/scriptless/test': { noScripts: true },
    '/nested/scriptless/spa': { ssr: false, noScripts: true },
  },
})
