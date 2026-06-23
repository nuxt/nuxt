export default defineNuxtPlugin(async () => {
  if (useRoute().path === '/spa-plugin-redirect/login') {
    await navigateTo('/spa-plugin-redirect/protected')
  }
})
