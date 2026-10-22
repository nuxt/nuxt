import { addRoute, createRouter, findAllRoutes } from 'rou3'
import { compileRouterToString } from 'rou3/compiler'
import type { CompileRouterToStringOptions } from 'rou3/compiler'
import { defu } from 'defu'
import { tryUseNitro } from '@nuxt/kit'
import type { Nuxt, RouteRuleConfig } from '@nuxt/schema'
import { decodeRoutePath, encodeRoutePath } from './index.ts'

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
  compileToString (options?: CompileRouterToStringOptions): string
}

const HTTP_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'CONNECT', 'TRACE', 'QUERY'])
const METHOD_KEY_RE = /^([A-Z]+)\s+(\/.*)$/i

/**
 * Split a `<METHOD> <path>` route-rule key into its HTTP method (empty when the key is not
 * method-scoped) and its path.
 *
 * @internal
 */
export function parseRouteRuleKey (key: string): { method: string, path: string } {
  const match = METHOD_KEY_RE.exec(key)
  const method = match?.[1]!.toUpperCase()
  return method && HTTP_METHODS.has(method) ? { method, path: match![2]! } : { method: '', path: key }
}

/**
 * The method and path of a route-rules entry, taken from `method` when set and from the key
 * otherwise.
 *
 * @internal
 */
export function parseRouteRulesRoute (route: RouteRulesRoute): { method: string, path: string } {
  return route.method ? { method: route.method.toUpperCase(), path: route.route } : parseRouteRuleKey(route.route)
}

/**
 * The routes whose rules apply to a request with `method`, keyed by path. Rules for every
 * method come first, then `GET` rules for a `HEAD` request, then rules scoped to `method`, so
 * that narrower scopes take precedence on the same path.
 *
 * @internal
 */
export function resolveMethodRouteRulesRoutes (routes: RouteRulesRoute[], method = 'GET'): RouteRulesRoute[] {
  const scopes = method === 'HEAD' ? ['', 'GET', 'HEAD'] : ['', method]
  const layers: RouteRulesRoute[][] = scopes.map(() => [])
  for (const route of routes) {
    const { method, path } = parseRouteRulesRoute(route)
    layers[scopes.indexOf(method)]?.push({ ...route, route: path, method })
  }
  return layers.flat()
}

/**
 * The rules that apply to a request with `method` (a page request by default), merged into one
 * entry per path so that narrower scopes override the rules for every method.
 *
 * @internal
 */
export function mergeMethodRouteRulesRoutes (routes: RouteRulesRoute[], method = 'GET'): RouteRulesRoute[] {
  const merged = new Map<string, Record<string, any>>()
  for (const { route, data } of resolveMethodRouteRulesRoutes(routes, method)) {
    merged.set(route, defu(data, merged.get(route)))
  }
  return [...merged].map(([route, data]) => ({ route, data }))
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
 * Normalise a lookup path like {@link normalizeRouteRulePath}, then percent-encode it the way
 * rou3 encodes the literal text of the keys it is matched against.
 *
 * @internal
 */
export function normalizeRouteRuleLookupPath (path: string, fold: boolean): string {
  return encodeRoutePath(normalizeRouteRulePath(path, fold))
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
      const { path } = parseRouteRuleKey(key)
      if (path.endsWith('/**')) {
        options.base = path.slice(0, -3)
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
 * Expand `appMiddleware` given as a name or a list of names into the record the server
 * runtime accepts. Matching entries are replaced, not mutated.
 *
 * @internal
 */
export function normalizeAppMiddlewareRules (routeRules: Record<string, Record<string, any> | undefined> | undefined): void {
  for (const route in routeRules) {
    const appMiddleware = routeRules[route]?.appMiddleware
    if (typeof appMiddleware !== 'string' && !Array.isArray(appMiddleware)) { continue }

    routeRules[route] = {
      ...routeRules[route],
      appMiddleware: Object.fromEntries([appMiddleware].flat().map(name => [name, true])),
    }
  }
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
  if (nitro?.routing) {
    return { routes: nitro.routing.routeRules.routes, baseURL: nitro.options.baseURL || '' }
  }
  const routes = Object.entries(normalizeRouteRules(nuxt.options.routeRules))
    .map(([route, data]) => ({ route, method: '', data }))
  return { routes, baseURL: nuxt.options.app.baseURL || '' }
}

/**
 * Build a route-rules router over the rules that apply to a request with `method` (a page
 * request by default): patterns are registered under `baseURL`, and a lookup resolves every
 * pattern it matches, least specific first.
 *
 * @internal
 */
export function createRouteRulesRouter (allRoutes: RouteRulesRoute[], baseURL: string, method = 'GET'): RouteRulesRouter {
  const routes = resolveMethodRouteRulesRoutes(allRoutes, method)
  const base = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
  const router = createRouter<Record<string, any>>()
  for (const route of routes) {
    addRoute(router, '', base + route.route, route.data)
  }

  return {
    routes,
    matchAll: (method, path) => findAllRoutes(router, method, path).map(route => route.data),
    compileToString (options) {
      // a lone catch-all under no base matches every path, so it compiles to its data rather
      // than a lookup; under a base the router compiles the prefix check itself
      if (base || routes.length !== 1 || routes[0]!.route !== '/**') {
        return compileRouterToString(router, options)
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
  `const encodeRoutePath = ${encodeRoutePath.toString()}`,
  `const normalizePath = (path, fold) => {`,
  `  if (typeof path !== 'string') { return path }`,
  `  const decoded = decodeRoutePath(path)`,
  `  return encodeRoutePath(fold ? decoded.toLowerCase() : decoded)`,
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
export function createNormalizedRouteRulesRouter (routes: RouteRulesRoute[], baseURL: string | undefined, fold: boolean, onDuplicate?: (existing: string, route: string, key: string) => void, method = 'GET'): RouteRulesRouter {
  const normalizedKeys = new Map<string, string>()
  const normalizedRoutes = resolveMethodRouteRulesRoutes(routes, method).map((route) => {
    if (typeof route.route !== 'string') { return route }
    const path = normalizeRouteRulePath(route.route, fold)
    const key = route.method ? `${route.method} ${path}` : path
    const original = route.method ? `${route.method} ${route.route}` : route.route
    const existing = normalizedKeys.get(key)
    if (existing !== undefined && existing !== original) {
      onDuplicate?.(existing, original, key)
    }
    normalizedKeys.set(key, original)
    return { ...route, route: path }
  })
  return createRouteRulesRouter(normalizedRoutes, normalizeRouteRulePath(String(baseURL || ''), fold), method)
}
