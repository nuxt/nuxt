import { START_LOCATION } from 'vue-router'
import type { RouteLocationNormalized, RouterScrollBehavior } from 'vue-router'
import type { RouterConfig } from 'nuxt/schema'
import { useNuxtApp } from '#app/nuxt'
import { isChangingPage } from '#app/components/utils'
import { useRouter } from '#app/composables/router'

type ScrollPosition = Awaited<ReturnType<RouterScrollBehavior>>

// Default router options
// https://router.vuejs.org/api/interfaces/routeroptions
export default <RouterConfig>{
  scrollBehavior (to, from, savedPosition) {
    const nuxtApp = useNuxtApp()
    const router = useRouter()
    // @ts-expect-error untyped, nuxt-injected option
    const hashScrollBehaviour = router.options?.scrollBehaviorType ?? 'auto'

    // keep the position the browser restored on load (see `scrollRestoration` in the router plugin)
    if (from === START_LOCATION && !savedPosition && !to.hash) {
      return false
    }

    // Hash routes on the same page, no page hook is fired so resolve here
    if (to.path.replace(/\/$/, '') === from.path.replace(/\/$/, '')) {
      if (from.hash && !to.hash) {
        return savedPosition ?? { left: 0, top: 0 }
      }
      if (to.hash) {
        return { el: to.hash, top: _getHashElementScrollMarginTop(to.hash), behavior: hashScrollBehaviour }
      }
      // The route isn't changing so keep current scroll position
      return false
    }

    const routeAllowsScrollToTop = typeof to.meta.scrollToTop === 'function' ? to.meta.scrollToTop(to, from) : to.meta.scrollToTop

    if (routeAllowsScrollToTop === false) { return false }

    if (from === START_LOCATION) {
      return _calculatePosition(to, from, savedPosition, hashScrollBehaviour)
    }

    return new Promise((resolve) => {
      const doScroll = (position?: ScrollPosition) => {
        requestAnimationFrame(() => {
          // A later navigation may have superseded this one while we waited for the
          // page transition to finish; scrolling now would apply the old destination's
          // position to the current page, so skip it (#34196).
          if (router.currentRoute.value.fullPath !== to.fullPath) {
            resolve(false)
            return
          }
          resolve(position ?? _calculatePosition(to, from, savedPosition, hashScrollBehaviour))
        })
      }
      nuxtApp.hooks.hookOnce('page:loading:end', () => {
        const transitionPromise = nuxtApp['~transitionPromise'] as Promise<void> | undefined
        // When the old and new pages overlap during the transition (the default Vue
        // transition mode, i.e. no `mode` or `mode: 'default'`), scrolling only after the
        // transition ends makes the new page visibly jump to the top at the end. Scroll
        // while the transition runs instead so the new page fades in already moving to the
        // top (#37130). Back/forward navigations (savedPosition) and hash targets keep the
        // existing behaviour of waiting for the transition to finish.
        if (transitionPromise && !savedPosition && !to.hash && _overlapsPages(to)) {
          doScroll({
            left: 0,
            top: 0,
            behavior: _prefersReducedMotion() ? 'instant' : 'smooth',
          })
        } else if (transitionPromise) {
          transitionPromise.then(() => doScroll())
        } else {
          doScroll()
        }
      })
    })
  },
}

function _overlapsPages (to: RouteLocationNormalized): boolean {
  const transition = to.meta.pageTransition
  return typeof transition === 'object' && transition !== null && (!transition.mode || transition.mode === 'default')
}

function _prefersReducedMotion (): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function _getHashElementScrollMarginTop (hash: string): number {
  const elem = document.getElementById(hash.slice(1))
  if (!elem) {
    return 0
  }
  return (Number.parseFloat(getComputedStyle(elem).scrollMarginTop) || 0) + (Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0)
}

function _calculatePosition (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  savedPosition: ScrollPosition | null,
  defaultHashScrollBehaviour: ScrollBehavior,
): ScrollPosition {
  // By default when the returned position is falsy or an empty object, vue-router will retain the current scroll position
  // savedPosition is only available for popstate navigations (back button)
  if (savedPosition) {
    return savedPosition
  }

  // Scroll to the element specified in the URL hash, if present
  if (to.hash) {
    return {
      el: to.hash,
      top: _getHashElementScrollMarginTop(to.hash),
      behavior: isChangingPage(to, from) ? defaultHashScrollBehaviour : 'instant',
    }
  }

  return {
    left: 0,
    top: 0,
  }
}
