import { KeepAliveProps, TransitionProps, UnwrapRef } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteRecordRedirectOption } from 'vue-router'

export interface PageMeta {
  [key: string]: any
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
}

declare module 'vue-router' {
  interface RouteMeta extends UnwrapRef<PageMeta> {}
}

const warnRuntimeUsage = (method: string) =>
  console.warn(
    `${method}() is a compiler-hint helper that is only usable inside ` +
      'the script block of a single file component. Its arguments should be ' +
      'compiled away and passing it at runtime has no effect.'
  )

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const definePageMeta = (meta: PageMeta): void => {
  if (process.dev) {
    warnRuntimeUsage('definePageMeta')
  }
}
