export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  if (to.path.startsWith('/redirect/')) {
    await new Promise(resolve => setTimeout(resolve, 100))
    return navigateTo(to.path.slice('/redirect/'.length - 1))
  }
  const pluginPath = nuxtApp.$path()
  if (process.server && !/redirect|navigate/.test(pluginPath) && to.path !== pluginPath) {
    throw new Error('plugin did not run before middleware')
  }
})
