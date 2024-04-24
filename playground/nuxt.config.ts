export default defineNuxtConfig({
  devtools: { enabled: true },
  future: {
    v4: true
  },
  modules: [
    function (_, nuxt) {
      console.log(nuxt.options.experimental)
    }
  ]
})
