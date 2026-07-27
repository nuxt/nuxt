export default defineNuxtPlugin({
  name: 'client-only-plugin',
  parallel: true,
  setup (nuxtApp) {
    if (nuxtApp.payload.serverRendered && nuxtApp.payload.blinkable !== '<revivified-blink>' && document.querySelector('#__NUXT_DATA__')) {
      throw createError({
        message: 'Custom type in Nuxt payload was not revived correctly',
      })
    }
  },
})
