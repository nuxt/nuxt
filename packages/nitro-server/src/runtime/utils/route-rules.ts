import { defu } from 'defu'
import type { H3Event } from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'
import type { NitroRouteRules } from 'nitropack/types'
import { createRouter, toRouteMatcher } from 'radix3'
import type { RouteMatcher } from 'radix3'
import { withoutBase } from 'ufo'

import { normalizeRouteRulePath } from '#internal/nuxt/route-rules.mjs'

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
  return defu({}, ...getMatcher().matchAll(normalizeRouteRulePath(path)).reverse()) as NitroRouteRules
}

/** Resolve the route rules for a request, as {@link matchRouteRules} does for its path. */
export function resolveRequestRouteRules (event: H3Event): NitroRouteRules {
  return matchRouteRules(withoutBase(event.path.split('?')[0]!, useRuntimeConfig().app.baseURL))
}

/** The route rules for a request, reusing those already resolved for it. */
export function getRouteRules (event: H3Event): NitroRouteRules {
  const context = event.context._nitro ||= {}
  return context.routeRules ||= resolveRequestRouteRules(event)
}
