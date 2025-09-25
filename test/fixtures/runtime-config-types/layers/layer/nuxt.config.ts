export default defineNuxtConfig({
  modules: [
    function (options, nuxt) {
      nuxt.options.runtimeConfig.layerNumber = 40
    },
  ],
  runtimeConfig: {
    inlinedInKayer: 'layer' as const,
    nested: {
      layer: 'bar',
    },
  },
})
