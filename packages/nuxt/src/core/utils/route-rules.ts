import { defu } from 'defu'
import { addRoute, createRouter, findAllRoutes } from 'rou3'
import { compileRouterToString } from 'rou3/compiler'
import type { RouterCompilerOptions } from 'rou3/compiler'
import { tryUseNitro } from '@nuxt/kit'
import type { Nuxt, RouteRuleConfig } from '@nuxt/schema'
import { decodeRoutePath, foldRouteCase, resolveRoutePathDotSegments } from './index.ts'

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
 * Normalise a route-rule key or lookup path: resolve `.` and `..` segments, decode
 * percent-encoding, then case-fold (see {@link foldRouteCase}) when `fold` is set. Keys are
 * matched in decoded form so that a rule may be authored either decoded (`/测试`, the usual
 * case) or encoded (`/%E6%B5%8B%E8%AF%95`, the form the page route and the request path take). Dot segments
 * are resolved before decoding, so a double-encoded `%252e` stays a literal segment.
 * Decoding must precede case folding, or a percent-encoded non-ASCII character would never
 * fold.
 *
 * @internal
 */
export function normalizeRouteRulePath (path: string, fold: boolean): string {
  const decoded = decodeRoutePath(resolveRoutePathDotSegments(path))
  return fold ? foldRouteCase(decoded) : decoded
}

/**
 * Normalise a route-rule key as {@link normalizeRouteRulePath} does, except for its regex
 * constraints (`:id(\\D+)`), which are never folded, and in which a percent-encoded character
 * decodes to a literal match of that character rather than to regex syntax.
 *
 * @internal
 */
export function normalizeRouteRuleKey (key: string, fold: boolean): string {
  return splitRouteConstraints(key)
    .map(part => part.constraint ? decodeRouteConstraint(part.text) : normalizeRouteRulePath(part.text, fold))
    .join('')
}

const ENCODED_RUN_RE = /(?:%[\da-f]{2})+/gi
const REGEX_SYNTAX_RE = /[\\^$.*+?()[\]{}|-]/g

function decodeRouteConstraint (constraint: string): string {
  return constraint.replace(ENCODED_RUN_RE, encoded => decodeRoutePath(encoded).replace(REGEX_SYNTAX_RE, '\\$&'))
}

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

const CONSTRAINT_ATOM_RE = /(?:%[\da-f]{2})+|\\(?:x[\da-f]{2}|u[\da-f]{4}|u\{[\da-f]+\}|c[a-z]|[0-7]{1,3}|[\s\S])|\[(?:\\[\s\S]|[^\]\\])*\]|[\s\S]/gi

let casePairs: Array<[char: string, folded: string]> | undefined

function getCasePairs (): Array<[char: string, folded: string]> {
  if (!casePairs) {
    casePairs = []
    for (let code = 0; code <= 0xFFFF; code++) {
      const char = String.fromCharCode(code)
      const folded = foldRouteCase(char)
      if (folded !== char) { casePairs.push([char, folded]) }
    }
  }
  return casePairs
}

/**
 * The first part of a regex constraint that matches a character but not its case-folded form
 * (see {@link foldRouteCase}), such as `A`, `[A-Z]`, `\x41` or `%C3%89`, or a negated class that
 * matches one form but not the other, such as `[^A-Z]`. Request paths are case-folded before they
 * are matched when routing is case-insensitive, so such a constraint would not match the way it
 * reads.
 *
 * @internal
 */
export function findCaseDependentConstraint (constraint: string): string | undefined {
  for (const [atom] of constraint.matchAll(CONSTRAINT_ATOM_RE)) {
    if (atom[0] === '%') {
      const decoded = decodeRoutePath(atom)
      if (foldRouteCase(decoded) !== decoded) { return atom }
      continue
    }
    if (atom.length === 1) {
      if (foldRouteCase(atom) !== atom) { return atom }
      continue
    }
    let regex: RegExp
    try {
      regex = new RegExp(atom)
    } catch {
      continue
    }
    const negated = atom.startsWith('[^')
    if (getCasePairs().some(([char, folded]) => negated ? regex.test(char) !== regex.test(folded) : regex.test(char) && !regex.test(folded))) { return atom }
  }
}

/**
 * The first part of a regex constraint in a route-rule key that depends on letter case (see
 * {@link findCaseDependentConstraint}), once percent-encoded characters are decoded as they are
 * for matching.
 *
 * @internal
 */
export function findCaseDependentRouteRuleKeyPart (key: string): string | undefined {
  for (const { text, constraint } of splitRouteConstraints(key)) {
    const part = constraint ? findCaseDependentConstraint(decodeRouteConstraint(text)) : undefined
    if (part !== undefined) { return part }
  }
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
 * {@link normalizeRouteRuleKey} under the same `fold`, so that lookups match them.
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
 * Source of the `normalizePath` helper a compiled matcher looks rules up through:
 * `decodeRoutePath`, `resolveRoutePathDotSegments` and `foldRouteCase` are inlined by source so
 * that the runtime lookup and the build-time key normalisation cannot drift apart.
 *
 * @internal
 */
export const normalizePathCode: string = [
  `const decodeRoutePath = ${decodeRoutePath.toString()}`,
  `const resolveRoutePathDotSegments = ${resolveRoutePathDotSegments.toString()}`,
  `const foldRouteCase = ${foldRouteCase.toString()}`,
  `const normalizePath = (path, fold) => {`,
  `  if (typeof path !== 'string') { return path }`,
  `  const decoded = decodeRoutePath(resolveRoutePathDotSegments(path))`,
  `  return fold ? foldRouteCase(decoded) : decoded`,
  `}`,
].join('\n')

/**
 * Build a route-rules router whose keys are normalised by {@link normalizeRouteRuleKey},
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
    const key = normalizeRouteRuleKey(route.route, fold)
    const existing = normalizedKeys.get(key)
    if (existing !== undefined && existing !== route.route) {
      onDuplicate?.(existing, route.route, key)
    }
    normalizedKeys.set(key, route.route)
    return { ...route, route: key }
  })
  return createRouteRulesRouter(normalizedRoutes, normalizeRouteRulePath(String(baseURL || ''), fold))
}
