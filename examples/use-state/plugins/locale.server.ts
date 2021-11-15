export default defineNuxtPlugin((nuxtApp) => {
  const locale = useLocale()
  locale.value = nuxtApp.ssrContext?.req.headers['accept-language']?.split(',')[0]
})
