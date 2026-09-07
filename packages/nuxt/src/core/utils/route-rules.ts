import { defu } from 'defu'
import { addRoute, createRouter, findAllRoutes } from 'rou3'
import { compileRouterToString } from 'rou3/compiler'
import type { RouterCompilerOptions } from 'rou3/compiler'
import { tryUseNitro } from '@nuxt/kit'
import type { Nuxt, RouteRuleConfig } from '@nuxt/schema'
import { decodeRoutePath } from './index.ts'

/**
 * Route-rule keys the client-side matcher is compiled from; anything else is server-only.
 *
 * @internal
 */
export const VALID_MANIFEST_KEYS = ['prerender', 'redirect', 'appMiddleware', 'appLayout', 'cache', 'isr', 'swr', 'ssr', 'noScripts']

/** One entry of a route-rules router: the pattern it matches and the rules it resolves to. */
export interface RouteRulesRoute {
  route: string
  method?: string
  data: Record<string, any>
}

/** A router over route rules, matching every pattern a path matches rather than the closest one. */
export interface RouteRulesRouter {
  routes: RouteRulesRoute[]
  matchAll (method: string, path: string): Record<string, any>[]
  compileToString (options?: RouterCompilerOptions): string
}

/**
 * Normalise a route-rule key or lookup path: decode percent-encoding, then case-fold when
 * `fold` is set. Keys are matched in decoded form so that a rule may be authored either
 * decoded (`/测试`, the usual case) or encoded (`/%E6%B5%8B%E8%AF%95`, the form the page route
 * and the request path take). Decoding must precede case folding, or a percent-encoded
 * non-ASCII character would never fold.
 *
 * @internal
 */
export function normalizeRouteRulePath (path: string, fold: boolean): string {
  const decoded = decodeRoutePath(path)
  return fold ? decoded.toLowerCase() : decoded
}

/**
 * Expand the rule shorthands a server runtime would expand: `redirect` as a string, and
 * `swr`/`cache` as the single `cache` rule everything downstream reads.
 *
 * @internal
 */
export function normalizeRouteRules (config: Record<string, RouteRuleConfig> | undefined): Record<string, Record<string, any>> {
  const normalized: Record<string, Record<string, any>> = {}
  for (const key in config) {
    const { redirect, swr, cache, ...rules } = (config[key] || {}) as Record<string, any>

    if (redirect) {
      const options: Record<string, unknown> = { to: '/', status: 307, ...typeof redirect === 'string' ? { to: redirect } : redirect }
      if (key.endsWith('/**')) {
        options.base = key.slice(0, -3)
      }
      rules.redirect = options
    } else if (redirect === false) {
      rules.redirect = false
    }

    if (swr !== undefined && swr !== false) {
      rules.cache = { ...cache || undefined, swr: true, ...typeof swr === 'number' ? { maxAge: swr } : {} }
    } else if (swr === false && cache === undefined) {
      rules.cache = false
    } else if (cache !== undefined) {
      rules.cache = cache === false ? false : cache
    }

    normalized[key] = rules
  }
  return normalized
}

/**
 * The route rules the build has resolved, as router entries.
 *
 * A server builder resolves its own (a module may push rules through `nitro:config`, and the
 * server may add rules of its own), so its resolved set is preferred where there is one.
 *
 * @internal
 */
export function resolveRouteRulesRoutes (nuxt: Nuxt): { routes: RouteRulesRoute[], baseURL: string } {
  const nitro = tryUseNitro()
  const rules: Record<string, Record<string, any>> = nitro
    ? nitro.options.routeRules
    : normalizeRouteRules(nuxt.options.routeRules)
  const baseURL = (nitro ? nitro.options.baseURL : nuxt.options.app.baseURL) || ''
  const routes = Object.entries(rules).map(([route, data]) => ({ route, method: '', data }))
  return { routes, baseURL }
}

/**
 * Resolve the route rules that apply to `path`, merged most-specific-last.
 *
 * The router is expected to have been built with keys normalised by
 * {@link normalizeRouteRulePath} under the same `fold`, so that lookups match them.
 *
 * @internal
 */
export function resolveRouteRules<T extends Record<string, any>> (router: RouteRulesRouter, path: string, fold: boolean): T {
  return defu({} as T, ...router.matchAll('', normalizeRouteRulePath(path, fold)).reverse())
}

/**
 * Build a route-rules router: patterns are registered under `baseURL`, and a lookup resolves
 * every pattern it matches, least specific first.
 *
 * @internal
 */
export function createRouteRulesRouter (routes: RouteRulesRoute[], baseURL: string): RouteRulesRouter {
  const base = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
  const router = createRouter<Record<string, any>>()
  for (const route of routes) {
    addRoute(router, route.method || '', base + route.route, route.data)
  }

  return {
    routes,
    matchAll: (method, path) => findAllRoutes(router, method, path).map(route => route.data),
    compileToString (options) {
      // a lone catch-all under no base matches every path, so it compiles to its data rather
      // than a lookup; under a base the router compiles the prefix check itself
      if (base || routes.length !== 1 || routes[0]!.route !== '/**' || !!routes[0]!.method) {
        return compileRouterToString(router, undefined, options)
      }
      const data = (options?.serialize || JSON.stringify)(routes[0]!.data)
      const match = `{data,params:{"_":p.slice(1)}}`
      return `/* @__PURE__ */ (() => {const data=${data};return ((_m, p)=>(${options?.matchAll ? `[${match}]` : match}));})()`
    },
  }
}

/**
 * Source of the `normalizePath` helper a compiled matcher looks rules up through: `decodeRoutePath`
 * is inlined by source so that the runtime lookup and the build-time key normalisation cannot
 * drift apart.
 *
 * @internal
 */
export const normalizePathCode: string = [
  `const decodeRoutePath = ${decodeRoutePath.toString()}`,
  `const normalizePath = (path, fold) => {`,
  `  if (typeof path !== 'string') { return path }`,
  `  const decoded = decodeRoutePath(path)`,
  `  return fold ? decoded.toLowerCase() : decoded`,
  `}`,
].join('\n')

/**
 * Build a route-rules router whose keys are decoded (and, when `fold` is set, lower-cased),
 * mirroring the normalised lookup path used at runtime.
 *
 * `onDuplicate` is called when two distinct keys normalise onto the same path; the later
 * key wins.
 *
 * @internal
 */
export function createNormalizedRouteRulesRouter (routes: RouteRulesRoute[], baseURL: string | undefined, fold: boolean, onDuplicate?: (existing: string, route: string, key: string) => void): RouteRulesRouter {
  const normalizedKeys = new Map<string, string>()
  const normalizedRoutes = routes.map((route) => {
    if (typeof route.route !== 'string') { return route }
    const key = normalizeRouteRulePath(route.route, fold)
    const existing = normalizedKeys.get(key)
    if (existing !== undefined && existing !== route.route) {
      onDuplicate?.(existing, route.route, key)
    }
    normalizedKeys.set(key, route.route)
    return { ...route, route: key }
  })
  return createRouteRulesRouter(normalizedRoutes, normalizeRouteRulePath(String(baseURL || ''), fold))
}
