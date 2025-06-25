import { START_LOCATION } from 'vue-router'
import type { RouteLocationNormalized, RouterScrollBehavior } from 'vue-router'
import type { RouterConfig } from 'nuxt/schema'
import { useNuxtApp } from '#app/nuxt'
import { isChangingPage } from '#app/components/utils'
import { useRouter } from '#app/composables/router'

type ScrollPosition = Awaited<ReturnType<RouterScrollBehavior>>

// Default router options
// https://router.vuejs.org/api/#routeroptions
export default <RouterConfig> {
  scrollBehavior (to, from, savedPosition) {
    const nuxtApp = useNuxtApp()
    // @ts-expect-error untyped, nuxt-injected option
    const behavior = useRouter().options?.scrollBehaviorType ?? 'auto'

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

    const routeAllowsScrollToTop = typeof to.meta.scrollToTop === 'function' ? to.meta.scrollToTop(to, from) : to.meta.scrollToTop

    if (routeAllowsScrollToTop === false) { return false }

    const hookToWait = nuxtApp._runningTransition ? 'page:transition:finish' : 'page:loading:end'

    return new Promise((resolve) => {
      if (from === START_LOCATION) {
        resolve(_calculatePosition(to, from, savedPosition))
        return
      }

      nuxtApp.hooks.hookOnce(hookToWait, () => {
        requestAnimationFrame(() => resolve(_calculatePosition(to, from, savedPosition)))
      })
    })
  },
}

function _getHashElementScrollMarginTop (selector: string): number {
  try {
    const elem = document.querySelector(selector)
    if (elem) {
      return (Number.parseFloat(getComputedStyle(elem).scrollMarginTop) || 0) + (Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0)
    }
  } catch {
    // ignore any errors parsing scrollMarginTop
  }
  return 0
}

function _calculatePosition (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  savedPosition: ScrollPosition | null,
): ScrollPosition {
  if (!savedPosition && isChangingPage(to, from) && !to.hash) {
    return { left: 0, top: 0 }
  }

  if (savedPosition) {
    return savedPosition
  }

  if (to.hash) {
    return {
      el: to.hash,
      top: _getHashElementScrollMarginTop(to.hash),
    }
  }

  return { left: 0, top: 0 }
}
