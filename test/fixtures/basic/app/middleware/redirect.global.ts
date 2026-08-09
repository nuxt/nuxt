import { withoutTrailingSlash } from 'ufo'

export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  if (useRequestEvent()?.req.headers.get('trailing-slash') && to.fullPath.endsWith('/')) {
    return navigateTo(withoutTrailingSlash(to.fullPath), { redirectCode: 307 })
  }
  if (to.path.startsWith('/redirect/')) {
    await new Promise(resolve => setTimeout(resolve, 100))
    return navigateTo(to.path.slice('/redirect/'.length - 1))
  }
  if (to.path === '/catchall/redirect-infinite') {
    // the path will be the same in this new route, so middleware will redirect in a
    // loop and Nuxt should respond with a 500 error
    return navigateTo('/catchall/redirect-infinite?test=true')
  }
  if (to.path === '/catchall/redirect-cycle-a') {
    return navigateTo('/catchall/redirect-cycle-b')
  }
  if (to.path === '/catchall/redirect-cycle-b') {
    return navigateTo('/catchall/redirect-cycle-a')
  }
  if (to.path === '/catchall/redirect-chain') {
    // two consecutive redirects (here and the `/redirect/` rule above), below the loop threshold
    return navigateTo('/redirect/catchall/not-found')
  }
  if (to.path === '/navigate-to-external') {
    return navigateTo('/', { external: true })
  }
  if (to.path === '/navigate-to-false') {
    return false
  }
  const pluginPath = nuxtApp.$path()
  if (import.meta.server && !/redirect|navigate/.test(pluginPath) && to.path !== pluginPath) {
    throw new Error('plugin did not run before middleware')
  }
})
