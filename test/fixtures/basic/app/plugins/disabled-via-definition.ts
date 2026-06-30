export default defineNuxtPlugin({
  name: 'disabled-via-definition',
  enabled: false,
  setup(nuxtApp) {
    nuxtApp.provide('disabledViaDefinition', 'This should not be available')
  },
})
