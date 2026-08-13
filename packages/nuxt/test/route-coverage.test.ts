import { describe, expect, it } from 'vitest'
import type { Nitro, NitroRouteConfig } from 'nitro/types'
import type { NuxtPage } from 'nuxt/schema'

import { markPagesCoveredByRouteRule } from '../src/pages/route-coverage.ts'

const UNESCAPE_RE = /\\(.)/g
const PARAM_RE = /(?:^|[^\\]):/

// mirrors rou3: dynamic tokens can be escaped, and literals match against the unescaped path
function segmentsMatch (route: string, path: string) {
  const routeSegments = route.split('/').filter(Boolean)
  const pathSegments = path.split('/').filter(Boolean)
  for (const [index, segment] of routeSegments.entries()) {
    if (segment.startsWith('**')) { return true }
    if (index >= pathSegments.length) { return false }
    if (segment === '*' || PARAM_RE.test(segment)) { continue }
    if (segment.replace(UNESCAPE_RE, '$1') !== pathSegments[index]) { return false }
  }
  return routeSegments.length === pathSegments.length
}

function createNitro (rules: Record<string, NitroRouteConfig>) {
  const routes = Object.entries(rules).map(([route, data]) => ({ route, data }))
  return {
    routing: {
      routeRules: {
        routes,
        // least specific first, as nitro's router returns matches
        matchAll: (_method: string, path: string) => routes
          .filter(({ route }) => segmentsMatch(route, path))
          .sort((a, b) => a.route.length - b.route.length)
          .map(({ data }) => data),
      },
    },
  } as unknown as Nitro
}

function isCovered (nitro: Nitro, pages: NuxtPage[]) {
  const marks = new Map<string, boolean>()
  markPagesCoveredByRouteRule(pages, nitro, {
    isCovered: rules => rules.ssr === false,
    mark: (_page, covered, resolvedPath) => { marks.set(resolvedPath, covered) },
  })
  return marks
}

describe('markPagesCoveredByRouteRule', () => {
  it('should not report coverage from a literal rule matching the probe segment', () => {
    const nitro = createNitro({
      '/**': { ssr: true },
      '/__nuxt_route_rule_probe__': { ssr: false },
    })
    expect(isCovered(nitro, [{ path: '/:slug()', file: 'slug.vue' }]).get('/:slug()')).toBe(false)
  })

  it('should treat an escaped colon as a literal segment rather than a param', () => {
    const nitro = createNitro({
      '/test\\:name': { ssr: false },
    })
    expect(isCovered(nitro, [{ path: '/test\\:name', file: 'test.vue' }]).get('/test\\:name')).toBe(true)
  })
})
