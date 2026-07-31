import { describe, expect, it } from 'vitest'
import type { Nitro, NitroRouteConfig } from 'nitropack/types'
import type { NuxtPage } from 'nuxt/schema'

import { markPagesCoveredByRouteRule } from '../src/pages/route-coverage.ts'

function createNitro (rules: Record<string, NitroRouteConfig>) {
  return { options: { routeRules: rules } } as unknown as Nitro
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
