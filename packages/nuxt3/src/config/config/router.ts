import { RouteRecordRaw, RouterScrollBehavior } from 'vue-router'

type UnionToIntersection<T> = (T extends any ? (k: T) => void : never) extends ((k: infer U) => void) ? U : never
type RouteConfig = UnionToIntersection<RouteRecordRaw>

export interface Route extends Pick<RouteConfig, Exclude<keyof RouteConfig, 'children' | 'component'>> {
  children?: Route[]
  chunkName?: string
  chunkNames?: Record<string, string>
  component?: RouteConfig['component'] | string
}
interface Middleware { }

export interface RouterConfigurationNormalized {
  base: string
  extendRoutes?(routes: Route[], resolve: (...pathSegments: string[]) => string): void
  fallback: boolean
  linkActiveClass: string | false
  linkExactActiveClass: string | false
  linkPrefetchedClass: string | false
  middleware: Middleware[]
  mode: 'history' | 'hash'
  parseQuery: boolean
  prefetchLinks: boolean
  prefetchPayloads: boolean
  routes: Route[]
  routeNameSplitter: string
  scrollBehavior: null | RouterScrollBehavior
  stringifyQuery: boolean
  trailingSlash?: boolean
}

export default (): RouterConfigurationNormalized => ({
  mode: 'history',
  base: '/',
  routes: [],
  routeNameSplitter: '-',
  middleware: [],
  linkActiveClass: 'nuxt-link-active',
  linkExactActiveClass: 'nuxt-link-exact-active',
  linkPrefetchedClass: false,
  extendRoutes: null,
  scrollBehavior: null,
  parseQuery: false,
  stringifyQuery: false,
  fallback: false,
  prefetchLinks: true,
  prefetchPayloads: true,
  trailingSlash: undefined
})
