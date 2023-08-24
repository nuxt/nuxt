import type { KeepAliveProps, TransitionProps, UnwrapRef } from 'vue'
import { getCurrentInstance } from 'vue'
import type { RouteLocationNormalized, RouteLocationNormalizedLoaded, RouteRecordRedirectOption } from '#vue-router'
import { useRoute } from 'vue-router'
import type { NitroRouteConfig } from 'nitropack'
import type { NuxtError } from '#app'

export interface PageMeta {
  [key: string]: unknown
  /**
   * Validate whether a given route can validly be rendered with this page.
   *
   * Return true if it is valid, or false if not. If another match can't be found,
   * this will mean a 404. You can also directly return an object with
   * statusCode/statusMessage to respond immediately with an error (other matches
   * will not be checked).
   */
  validate?: (route: RouteLocationNormalized) => boolean | Partial<NuxtError> | Promise<boolean | Partial<NuxtError>>
  /**
   * Where to redirect if the route is directly matched. The redirection happens
   * before any navigation guard and triggers a new navigation with the new
   * target location.
   */
  redirect?: RouteRecordRedirectOption
  /**
   * Aliases for the record. Allows defining extra paths that will behave like a
   * copy of the record. Allows having paths shorthands like `/users/:id` and
   * `/u/:id`. All `alias` and `path` values must share the same params.
   */
  alias?: string | string[]
  pageTransition?: boolean | TransitionProps
  layoutTransition?: boolean | TransitionProps
  key?: false | string | ((route: RouteLocationNormalizedLoaded) => string)
  keepalive?: boolean | KeepAliveProps
  /** You may define a name for this page's route. */
  name?: string
  /** You may define a path matcher, if you have a more complex pattern than can be expressed with the file name. */
  path?: string
  /** Set to `false` to avoid scrolling to top on page navigations */
  scrollToTop?: boolean | ((to: RouteLocationNormalizedLoaded, from: RouteLocationNormalizedLoaded) => boolean)
}

declare module 'vue-router' {
  interface RouteMeta extends UnwrapRef<PageMeta> {}
}

const warnRuntimeUsage = (method: string) =>
  console.warn(
    `${method}() is a compiler-hint helper that is only usable inside ` +
    'the script block of a single file component which is also a page. Its arguments should be ' +
    'compiled away and passing it at runtime has no effect.'
  )

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const definePageMeta = (meta: PageMeta): void => {
  if (import.meta.dev) {
    const component = getCurrentInstance()?.type
    try {
      const isRouteComponent = component && useRoute().matched.some(p => Object.values(p.components || {}).includes(component))
      if (isRouteComponent) {
        // don't warn if it's being used in a route component
        return
      }
    } catch {}
    warnRuntimeUsage('definePageMeta')
  }
}

/**
 * You can define route rules for the current page. Matching route rules will be created, based on the page's _path_.
 *
 * For example, a rule defined in `~/pages/foo/bar.vue` will be applied to `/foo/bar` requests. A rule in
 * `~/pages/foo/[id].vue` will be applied to `/foo/**` requests.
 *
 * For more control, such as if you are using a custom `path` or `alias` set in the page's `definePageMeta`, you
 * should set `routeRules` directly within your `nuxt.config`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const defineRouteRules = (rules: NitroRouteConfig): void => {}
