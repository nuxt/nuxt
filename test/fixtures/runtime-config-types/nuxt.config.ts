export default defineNuxtConfig({
  modules: [
    function (options, nuxt) {
      nuxt.options.runtimeConfig.setByInlineModule = 40

      // @ts-expect-error this should be typed
      nuxt.options.runtimeConfig.public.setByModule = 'module'
    },
  ],
  runtimeConfig: {
    inlinedInTopLevel: 'foo',
    public: {
      publicInlinedInTopLevel: 42,
    },
    nested: {
      topLevel: 'foo',
    },
  },
})
