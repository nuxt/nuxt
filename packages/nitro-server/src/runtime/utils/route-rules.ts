import { defu } from 'defu'
import type { H3Event } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import type { NitroRouteRules } from 'nitropack/types'
import { createRouter, toRouteMatcher } from 'radix3'
import type { RouteMatcher } from 'radix3'
import { withoutBase } from 'ufo'

import { matchAllRouteRules, normalizeRouteRulePath } from '#internal/nuxt/route-rules.mjs'

let matcher: RouteMatcher | undefined

function getMatcher (): RouteMatcher {
  if (!matcher) {
    const routes: Record<string, NitroRouteRules> = {}
    for (const [route, rules] of Object.entries(useRuntimeConfig().nitro?.routeRules || {})) {
      routes[normalizeRouteRulePath(route)] = rules as NitroRouteRules
    }
    matcher = toRouteMatcher(createRouter({ routes }))
  }
  return matcher
}

/**
 * Resolve the route rules for a path without the base URL. Keys and path are decoded,
 * and case-folded unless routing is `sensitive`.
 */
export function matchRouteRules (path: string): NitroRouteRules {
  return defu({}, ...matchAllRouteRules(path => getMatcher().matchAll(normalizeRouteRulePath(path)), path).reverse()) as NitroRouteRules
}

const STRIP_BASE_KEYS = { redirect: '_redirectStripBase', proxy: '_proxyStripBase' } as const

function withRequestStripBases (rules: NitroRouteRules, path: string, baseURL: string): NitroRouteRules {
  for (const [name, key] of Object.entries(STRIP_BASE_KEYS) as [keyof typeof STRIP_BASE_KEYS, string][]) {
    const options = rules[name] as Record<string, unknown> | undefined
    const stripBase = options?.[key]
    if (typeof stripBase !== 'string') { continue }
    const base = baseURL.replace(/\/$/, '') + stripBase
    const prefix = path.split('/').slice(0, base.split('/').length).join('/')
    if (prefix !== stripBase && normalizeRouteRulePath(prefix) === normalizeRouteRulePath(base)) {
      (rules as Record<string, unknown>)[name] = { ...options, [key]: prefix }
    }
  }
  return rules
}

/**
 * Resolve the route rules for a request, as {@link matchRouteRules} does for its path. The
 * strip base of a wildcard `redirect` or `proxy` rule is taken from the request path.
 */
export function resolveRequestRouteRules (event: H3Event): NitroRouteRules {
  const path = event.path.split('?')[0]!
  const baseURL = useRuntimeConfig().app.baseURL
  return withRequestStripBases(matchRouteRules(withoutBase(path, baseURL)), path, baseURL)
}

/** The route rules for a request, reusing those already resolved for it. */
export function getRouteRules (event: H3Event): NitroRouteRules {
  const context = event.context._nitro ||= {}
  return context.routeRules ||= resolveRequestRouteRules(event)
}
