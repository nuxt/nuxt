export default defineNuxtPlugin((nuxtApp) => {
  if (nuxtApp.payload.serverRendered && nuxtApp.payload.blinkable !== '<revivified-blink>') {
    throw createError({
      message: 'Custom type in Nuxt payload was not revived correctly'
    })
  }
})
