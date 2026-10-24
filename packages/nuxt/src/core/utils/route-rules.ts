import { addRoute, createRouter, findAllRoutes } from 'rou3'
import { compileRouterToString } from 'rou3/compiler'
import type { CompileRouterToStringOptions } from 'rou3/compiler'
import { defu } from 'defu'
import { tryUseNitro } from '@nuxt/kit'
import { pageDiagnostics } from '@nuxt/kit/internal'
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
 * Split a route pattern into its literal text and its regex constraint groups, in order.
 */
function splitRouteConstraints (pattern: string): Array<{ text: string, constraint: boolean }> {
  const parts: Array<{ text: string, constraint: boolean }> = []
  let start = 0
  let depth = 0
  let inClass = false
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]
    if (char === '\\') {
      i++
      continue
    }
    if (depth === 0) {
      if (char === '(') {
        parts.push({ text: pattern.slice(start, i), constraint: false })
        start = i
        depth = 1
      }
      continue
    }
    if (inClass) {
      inClass = char !== ']'
    } else if (char === '[') {
      inClass = true
    } else if (char === '(') {
      depth++
    } else if (char === ')' && --depth === 0) {
      parts.push({ text: pattern.slice(start, i + 1), constraint: true })
      start = i + 1
    }
  }
  parts.push({ text: pattern.slice(start), constraint: depth > 0 })
  return parts
}

const ROUTE_KEY_ENCODE_RE = /[\0-\x20"#<>`]|[^\0-\x7E]/gu
const LONE_SURROGATE_RE = /[\uD800-\uDFFF]/u

/**
 * Percent-encode a route pattern the way h3 normalizes route rule keys, leaving existing escapes intact.
 *
 * @internal
 */
export function encodeRoutePattern (pattern: string): string {
  return pattern.replace(ROUTE_KEY_ENCODE_RE, char => encodeURIComponent(char.replace(LONE_SURROGATE_RE, '\uFFFD')))
}

/**
 * Lower-case a request path for case-insensitive route rule matching. Percent-encoded
 * characters are folded too, so `/%C3%89cole` folds to `/%C3%A9cole`.
 *
 * Inlined by source into the server bundle, so it must not reference anything outside itself.
 *
 * @internal
 */
export function foldRouteRulePath (path: string): string {
  return path.replace(/(?:%[\da-f]{2})+|[^%]+/gi, (run) => {
    if (run[0] !== '%') { return run.toLowerCase() }
    try {
      const decoded = decodeURIComponent(run)
      const folded = decoded.toLowerCase()
      return folded === decoded ? run : encodeURIComponent(folded)
    } catch {
      return run
    }
  })
}

/**
 * Lower-case a route rule pattern as {@link foldRouteRulePath} does a request path, keeping
 * param names, backslash escapes and regex constraints as written.
 *
 * @internal
 */
export function foldRouteRulePattern (pattern: string): string {
  return splitRouteConstraints(pattern)
    .map((part) => {
      if (part.constraint) { return part.text }
      return part.text.replace(/\\.|:\w+|[^\\:]+|:/g, token => token[0] === '\\' || (token[0] === ':' && token.length > 1) ? token : foldRouteRulePath(token))
    })
    .join('')
}

const CONSTRAINT_ATOM_RE = /(?:%[\da-f]{2})+|\\(?:x[\da-f]{2}|u[\da-f]{4}|u\{[\da-f]+\}|c[a-z]|[0-7]{1,3}|[\s\S])|\[(?:\\[\s\S]|[^\]\\])*\]|[\s\S]/gi

let casePairs: Array<[upper: string, lower: string]> | undefined

function getCasePairs (): Array<[upper: string, lower: string]> {
  if (!casePairs) {
    casePairs = []
    for (let code = 0; code <= 0xFFFF; code++) {
      const char = String.fromCharCode(code)
      const lower = char.toLowerCase()
      if (lower !== char && lower.length === 1 && (code < 0x80 || lower.charCodeAt(0) >= 0x80)) { casePairs.push([char, lower]) }
    }
  }
  return casePairs
}

/**
 * The first part of a regex constraint that matches an upper-case letter but not its lower-case
 * form, such as `A`, `[A-Z]`, `\x41` or `%C3%89`, or a negated class that matches one form but
 * not the other, such as `[^A-Z]`. Request paths are lower-cased before they are matched when
 * routing is case-insensitive, so such a constraint would not match the way it reads.
 *
 * @internal
 */
export function findCaseDependentConstraint (constraint: string): string | undefined {
  for (const [atom] of constraint.matchAll(CONSTRAINT_ATOM_RE)) {
    if (atom[0] === '%') {
      const decoded = decodeRoutePath(atom)
      if (decoded.toLowerCase() !== decoded) { return atom }
      continue
    }
    if (atom.length === 1) {
      if (atom.toLowerCase() !== atom) { return atom }
      continue
    }
    let regex: RegExp
    try {
      regex = new RegExp(atom)
    } catch {
      continue
    }
    const negated = atom.startsWith('[^')
    if (getCasePairs().some(([upper, lower]) => negated ? regex.test(upper) !== regex.test(lower) : regex.test(upper) && !regex.test(lower))) { return atom }
  }
}

/**
 * Throw if a regex constraint in a route-rule key depends on letter case (see
 * {@link findCaseDependentConstraint}), for keys matched case-insensitively.
 *
 * @internal
 */
export function assertCaseIndependentRouteRuleKey (key: string): void {
  for (const { text, constraint } of splitRouteConstraints(key)) {
    const part = constraint ? findCaseDependentConstraint(text) : undefined
    if (part !== undefined) {
      throw pageDiagnostics.NUXT_B4022({ route: key, part })
    }
  }
}

/**
 * Normalise a route-rule key like {@link normalizeRouteRulePath}, except for its regex
 * constraints. rou3 tests a constraint against the encoded path segment, so constraints are
 * percent-encoded the way h3 encodes route-rule keys, never decoded or folded.
 *
 * @internal
 */
export function normalizeRouteRuleKey (key: string, fold: boolean): string {
  return splitRouteConstraints(key)
    .map((part) => {
      return part.constraint ? encodeRoutePattern(part.text) : normalizeRouteRulePath(part.text, fold)
    })
    .join('')
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
 * Build a route-rules router whose keys are normalised with {@link normalizeRouteRuleKey},
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
    const path = normalizeRouteRuleKey(route.route, fold)
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
