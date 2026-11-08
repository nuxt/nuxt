export default defineNuxtConfig({
  extends: ['../route-scroll'],
  routeRules: { '/nested/scriptless/test': { noScripts: true } },
})
