import { nextTick } from 'vue'
import type { RouterConfig } from 'nuxt/schema'
import { START_LOCATION } from 'vue-router'
import type { RouteLocationNormalized, RouterScrollBehavior } from '#vue-router'
import { useNuxtApp } from '#app/nuxt'
import { useRouter } from '#app/composables/router'
// @ts-expect-error virtual file
import { appPageTransition as defaultPageTransition } from '#build/nuxt.config.mjs'

type ScrollPosition = Awaited<ReturnType<RouterScrollBehavior>>

// Default router options
// https://router.vuejs.org/api/#routeroptions
export default <RouterConfig>{
  scrollBehavior: (
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    savedPosition: ScrollPosition | null
  ) => {
    // Check if the navigation is the first page load
    const isFirstLoad = from === START_LOCATION
    const nuxtApp = useNuxtApp()
    // @ts-expect-error untyped, nuxt-injected option
    const scrollBehaviorType = useRouter().options?.scrollBehaviorType ?? 'auto'

    // Handle page reload scenario where the saved position should be used
    if (isFirstLoad && savedPosition) {
      // Restore browser's default scroll behavior to auto (vue-router sets this when using custom ScrollBehavior)
      // to avoid page jumps on load
      window.history.scrollRestoration = 'auto'
      return savedPosition
    }
    // For other navigations, ensure manual scrollRestoration
    window.history.scrollRestoration = 'manual'

    // Check if the route explicitly disables automatic scroll to top
    const routeAllowsScrollToTop = typeof to.meta.scrollToTop === 'function' ? to.meta.scrollToTop(to, from) : to.meta.scrollToTop
    if (routeAllowsScrollToTop === false) {
      return false // Do not scroll to top if the route disallows it
    }

    // Handle same page navigation or first load
    if (isFirstLoad || to.path === from.path) {
      return _calculatePosition(to, savedPosition, to.path === from.path || isFirstLoad ? scrollBehaviorType : 'instant')
    }

    // Check if the route change involves a page transition
    const routeHasTransition = (route: RouteLocationNormalized): boolean => {
      return !!(route.meta.pageTransition ?? defaultPageTransition) && !isFirstLoad
    }
    const hasTransition = (routeHasTransition(from) && routeHasTransition(to))

    // Wait for page transition to finish before applying the scroll behavior
    const hookToWait = hasTransition ? 'page:transition:finish' : 'page:finish'
    return new Promise((resolve) => {
      nuxtApp.hooks.hookOnce(hookToWait, () => {
        return nextTick(() => {
          // Without this setTimeout, the scroll behaviour is not applied, this is however working reliably
          // todo: figure out how we can solve this without setTimeout of 0ms
          setTimeout(() => resolve(_calculatePosition(to, savedPosition, 'instant')), 0)
        })
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
  } catch {
    // ignore any errors parsing scrollMarginTop
  }
  return 0
}

function _calculatePosition (
  to: RouteLocationNormalized,
  savedPosition: ScrollPosition | null,
  scrollBehaviorType: ScrollBehavior
): ScrollPosition {
  // Handle saved position for backward/forward navigation
  if (savedPosition) {
    return savedPosition
  }

  // Scroll to the element specified in the URL hash, if present
  if (to.hash) {
    return { el: to.hash, top: _getHashElementScrollMarginTop(to.hash), behavior: scrollBehaviorType }
  }

  // Default scroll to the top left of the page
  return { left: 0, top: 0, behavior: scrollBehaviorType }
}
