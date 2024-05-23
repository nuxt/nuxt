export default defineNuxtConfig({
  modules: [
    function (_options, nuxt) {
      // @ts-expect-error not valid nuxt option
      nuxt.options.__installed_layer = true
    },
  ],
})
