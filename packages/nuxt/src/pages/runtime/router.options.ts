import type { RouterConfig } from '@nuxt/schema'
import type { RouterScrollBehavior, RouteLocationNormalized } from 'vue-router'
import { nextTick } from 'vue'
import { useNuxtApp } from '#app'
// @ts-ignore
import { appPageTransition as defaultPageTransition } from '#build/nuxt.config.mjs'

type ScrollPosition = Awaited<ReturnType<RouterScrollBehavior>>

// Default router options
// https://router.vuejs.org/api/#routeroptions
export default <RouterConfig> {
  scrollBehavior (to, from, savedPosition) {
    const nuxtApp = useNuxtApp()

    // By default when the returned position is falsy or an empty object, vue-router will retain the current scroll position
    // savedPosition is only available for popstate navigations (back button)
    let position: ScrollPosition = savedPosition || undefined

    // Scroll to top if route is changed by default
    if (!position && from && to && to.meta.scrollToTop !== false && _isDifferentRoute(from, to)) {
      position = { left: 0, top: 0 }
    }

    // Hash routes on the same page, no page hook is fired so resolve here
    if (to.path === from.path) {
      if (from.hash && !to.hash) {
        return { left: 0, top: 0 }
      }
      if (to.hash) {
        return { el: to.hash, top: _getHashElementScrollMarginTop(to.hash) }
      }
    }

    // Wait for `page:transition:finish` or `page:finish` depending on if transitions are enabled or not
    const hasTransition = (route: RouteLocationNormalized) => !!(route.meta.pageTransition ?? defaultPageTransition)
    const hookToWait = (hasTransition(from) && hasTransition(to)) ? 'page:transition:finish' : 'page:finish'
    return new Promise((resolve) => {
      nuxtApp.hooks.hookOnce(hookToWait, async () => {
        await nextTick()
        if (to.hash) {
          position = { el: to.hash, top: _getHashElementScrollMarginTop(to.hash) }
        }
        resolve(position)
      })
    })
  }
}

function _getHashElementScrollMarginTop (selector: string): number {
  try {
    const elem = document.querySelector(selector)
    if (elem) {
      return parseFloat(getComputedStyle(elem).scrollMarginTop)
    }
  } catch {}
  return 0
}

function _isDifferentRoute (a: RouteLocationNormalized, b: RouteLocationNormalized): boolean {
  const samePageComponent = a.matched[0] === b.matched[0]
  if (!samePageComponent) {
    return true
  }
  if (samePageComponent && JSON.stringify(a.params) !== JSON.stringify(b.params)) {
    return true
  }
  return false
}
