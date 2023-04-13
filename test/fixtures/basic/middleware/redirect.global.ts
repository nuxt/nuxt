import { withoutTrailingSlash } from 'ufo'

export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  if (useRequestHeaders(['trailing-slash'])['trailing-slash'] && to.fullPath.endsWith('/')) {
    return navigateTo(withoutTrailingSlash(to.fullPath), { redirectCode: 307 })
  }
  if (to.path.startsWith('/redirect/')) {
    await new Promise(resolve => setTimeout(resolve, 100))
    return navigateTo(to.path.slice('/redirect/'.length - 1))
  }
  if (to.path === '/redirect-infinite') {
    // the path will be the same in this new route and vue-router should send a 500 response
    return navigateTo('/redirect-infinite?test=true')
  }
  if (to.path === '/navigate-to-external') {
    return navigateTo('/', { external: true })
  }
  if (to.path === '/navigate-to-false') {
    return false
  }
  const pluginPath = nuxtApp.$path()
  if (process.server && !/redirect|navigate/.test(pluginPath) && to.path !== pluginPath) {
    throw new Error('plugin did not run before middleware')
  }
})
