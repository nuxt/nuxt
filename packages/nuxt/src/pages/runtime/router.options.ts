import type { RouteLocationNormalized, RouterScrollBehavior } from '#vue-router'
import type { RouterConfig } from 'nuxt/schema'
import { useNuxtApp } from '#app/nuxt'
import { isChangingPage } from '#app/components/utils'
import { useRouter } from '#app/composables/router'
// @ts-expect-error virtual file
import { appLayoutTransition as defaultLayoutTransition, appPageTransition as defaultPageTransition } from '#build/nuxt.config.mjs'

type ScrollPosition = Awaited<ReturnType<RouterScrollBehavior>>

// Default router options
// https://router.vuejs.org/api/#routeroptions
export default <RouterConfig> {
  scrollBehavior (to, from, savedPosition) {
    const nuxtApp = useNuxtApp()
    // @ts-expect-error untyped, nuxt-injected option
    const behavior = useRouter().options?.scrollBehaviorType ?? 'auto'

    // By default when the returned position is falsy or an empty object, vue-router will retain the current scroll position
    // savedPosition is only available for popstate navigations (back button)
    let position: ScrollPosition = savedPosition || undefined

    const routeAllowsScrollToTop = typeof to.meta.scrollToTop === 'function' ? to.meta.scrollToTop(to, from) : to.meta.scrollToTop

    // Scroll to top if route is changed by default
    if (!position && from && to && routeAllowsScrollToTop !== false && isChangingPage(to, from)) {
      position = { left: 0, top: 0 }
    }

    // Hash routes on the same page, no page hook is fired so resolve here
    if (to.path === from.path) {
      if (from.hash && !to.hash) {
        return { left: 0, top: 0 }
      }
      if (to.hash) {
        return { el: to.hash, top: _getHashElementScrollMarginTop(to.hash), behavior }
      }
      // The route isn't changing so keep current scroll position
      return false
    }

    // Wait for `page:transition:finish`, `page:finish`, or `layout:transition:finish` depending on if transitions are enabled or not
    const hookToWait = _getHookToWait(from, to)
    return new Promise((resolve) => {
      nuxtApp.hooks.hookOnce(hookToWait, async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
        if (to.hash) {
          position = { el: to.hash, top: _getHashElementScrollMarginTop(to.hash), behavior }
        }
        resolve(position)
      })
    })
  }
}

function _getHookToWait (from: RouteLocationNormalized, to: RouteLocationNormalized) {
  const hasTransition = (route: RouteLocationNormalized) => !!(route.meta.pageTransition ?? defaultPageTransition)
  const hasLayoutTransition = (route: RouteLocationNormalized) => !!(route.meta.layoutTransition ?? defaultLayoutTransition)

  if (_isDifferentLayout(from, to)) {
    return (hasLayoutTransition(from) && hasLayoutTransition(to)) ? 'layout:transition:finish' : 'layout:finish'
  }
  return (hasTransition(from) && hasTransition(to)) ? 'page:transition:finish' : 'page:finish'
}

function _getHashElementScrollMarginTop (selector: string): number {
  try {
    const elem = document.querySelector(selector)
    if (elem) {
      return parseFloat(getComputedStyle(elem).scrollMarginTop)
    }
  } catch {
    // ignore any errors parsing scrollMarginTop
  }
  return 0
}

function _isDifferentLayout (from: RouteLocationNormalized, to: RouteLocationNormalized): boolean {
  return from.meta.layout !== to.meta.layout
}
