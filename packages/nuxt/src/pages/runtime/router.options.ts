import { START_LOCATION } from 'vue-router'
import type { RouteLocationNormalized, RouterScrollBehavior } from 'vue-router'
import type { RouterConfig } from 'nuxt/schema'
import { useNuxtApp } from '#app/nuxt'
import { isChangingPage } from '#app/components/utils'
import { useRouter } from '#app/composables/router'
import { generateRouteRecordKey } from './utils'

type ScrollPosition = Awaited<ReturnType<RouterScrollBehavior>>

// Default router options
// https://router.vuejs.org/api/interfaces/routeroptions
export default <RouterConfig>{
  scrollBehavior (to, from, savedPosition) {
    const nuxtApp = useNuxtApp()
    const router = useRouter()
    // @ts-expect-error untyped, nuxt-injected option
    const hashScrollBehaviour = router.options?.scrollBehaviorType ?? 'auto'

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

    // Changing only a nested page leaves every page above it mounted, so scrolling the window
    // would move a parent page the user never navigated away from (#31638). An explicit
    // `scrollToTop`, a restored position or a hash target still take precedence.
    if (routeAllowsScrollToTop !== true && !savedPosition && !to.hash && isChangingOnlyChildPage(to, from)) {
      return false
    }

    if (from === START_LOCATION) {
      return _calculatePosition(to, from, savedPosition, hashScrollBehaviour)
    }

    return new Promise((resolve) => {
      const doScroll = () => {
        requestAnimationFrame(() => {
          // A later navigation may have superseded this one while we waited for the
          // page transition to finish; scrolling now would apply the old destination's
          // position to the current page, so skip it (#34196).
          if (router.currentRoute.value.fullPath !== to.fullPath) {
            resolve(false)
            return
          }
          resolve(_calculatePosition(to, from, savedPosition, hashScrollBehaviour))
        })
      }
      nuxtApp.hooks.hookOnce('page:loading:end', () => {
        const transitionPromise = nuxtApp['~transitionPromise'] as Promise<void> | undefined
        if (transitionPromise) {
          transitionPromise.then(doScroll)
        } else {
          doScroll()
        }
      })
    })
  },
}

/**
 * Return `true` if navigation only rerenders pages nested below the leaf route, leaving every
 * page component above it mounted. This mirrors the parent-rerender check `<NuxtPage>` uses to
 * decide whether it has to rerender (see `haveParentRoutesRendered` in `./page`).
 */
function isChangingOnlyChildPage (to: RouteLocationNormalized, from: RouteLocationNormalized): boolean {
  // Parent routes without a component are transparent — vue-router renders the child directly
  // at the parent's depth (see #34967), so they don't contribute a page render above us.
  const toParents = to.matched.slice(0, -1).filter(m => m.components?.default)
  const fromParents = from.matched.slice(0, -1).filter(m => m.components?.default)

  if (!toParents.length || toParents.length !== fromParents.length) { return false }

  return toParents.every((match, index) => {
    const fromMatch = fromParents[index]!
    return match.components?.default === fromMatch.components?.default &&
      generateRouteRecordKey(to, match) === generateRouteRecordKey(from, fromMatch)
  })
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
