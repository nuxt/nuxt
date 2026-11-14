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

    // If only the params of the deepest nested page changed, its parent page is not
    // re-rendered, so keep the current window scroll position, unless scrolling was
    // explicitly requested (#31638).
    if (!routeAllowsScrollToTop && !savedPosition && !to.hash && _isNestedPageParamChange(to, from)) { return false }

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

const ROUTE_PARAM_RE = /:(\w+)(?:\([^)]+\))?[?+*]?/g

function _resolveMatchedPath (path: string, params: RouteLocationNormalized['params']): string {
  return path.replace(ROUTE_PARAM_RE, (_, name: string) => String(params[name] ?? ''))
}

/**
 * Whether the navigation only changed the params of the deepest matched route,
 * leaving every parent page (and therefore the layout) untouched.
 */
function _isNestedPageParamChange (to: RouteLocationNormalized, from: RouteLocationNormalized): boolean {
  if (to.matched.length < 2 || to.matched.length !== from.matched.length) { return false }

  // If every matched route record is the same, only params can have changed
  if (!to.matched.every((record, index) => record === from.matched[index])) { return false }

  // The parent's resolved path includes every ancestor param, so if it is unchanged
  // only a param of the nested page itself can differ
  const parent = to.matched[to.matched.length - 2]
  if (!parent) { return false }
  return _resolveMatchedPath(parent.path, to.params) === _resolveMatchedPath(parent.path, from.params)
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
