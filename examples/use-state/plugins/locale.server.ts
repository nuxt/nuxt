/**
 * Nuxt will automatically read the files in your plugins directory and load them.
 * You can use .server or .client in the file name to load a plugin just on server- or client-side.
 * https://v3.nuxtjs.org/docs/directory-structure/plugins
 */
export default defineNuxtPlugin((nuxtApp) => {
  const locale = useLocale()
  // Learn more about the nuxtApp interface on https://v3.nuxtjs.org/docs/usage/nuxt-app#nuxtapp-interface-advanced
  const req = nuxtApp.ssrContext?.req

  // Set default locale based request headers (browser locale)
  locale.value = locale.value ?? req.headers['accept-language']?.split(',')[0]
})
