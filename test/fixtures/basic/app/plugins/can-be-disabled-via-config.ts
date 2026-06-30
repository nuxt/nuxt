export default defineNuxtPlugin({
  name: 'can-be-disabled-via-config',
  setup(nuxtApp) {
    nuxtApp.provide('disabledViaConfig', 'This can be disabled via config')
  },
})
