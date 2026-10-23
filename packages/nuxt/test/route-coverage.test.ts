import { describe, expect, it } from 'vitest'
import type { Nitro, NitroRouteConfig } from 'nitropack/types'
import type { NuxtPage } from 'nuxt/schema'

import { markPagesCoveredByRouteRule } from '../src/pages/route-coverage.ts'

function createNitro (rules: Record<string, NitroRouteConfig>) {
  return { options: { routeRules: rules } } as unknown as Nitro
}

function isCovered (nitro: Nitro, pages: NuxtPage[], options: { sensitive?: boolean } = {}) {
  const marks = new Map<string, boolean>()
  markPagesCoveredByRouteRule(pages, nitro, {
    isCovered: rules => rules.ssr === false,
    mark: (_page, covered, resolvedPath) => { marks.set(resolvedPath, covered) },
    ...options,
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

  it('should not report a dynamic page as covered when a more specific rule differs only by case', () => {
    const nitro = createNitro({
      '/Admin/**': { ssr: false },
      '/Admin/secret': { ssr: true },
    })
    expect(isCovered(nitro, [{ path: '/Admin/:id()', file: 'admin.vue' }]).get('/Admin/:id()')).toBe(false)
  })

  it('should keep a dynamic page uncovered under sensitive: true when rules differ by case', () => {
    const nitro = createNitro({
      '/Admin/**': { ssr: false },
      '/Admin/secret': { ssr: true },
    })
    expect(isCovered(nitro, [{ path: '/Admin/:id()', file: 'admin.vue' }], { sensitive: true }).get('/Admin/:id()')).toBe(false)
  })

  it('should not report a dynamic page as covered when its path is percent-encoded', () => {
    const nitro = createNitro({
      '/café/**': { ssr: false },
      '/café/secret': { ssr: true },
    })
    expect(isCovered(nitro, [{ path: '/caf%C3%A9/:id()', file: 'cafe.vue' }]).get('/caf%C3%A9/:id()')).toBe(false)
  })

  it('should not report a dynamic page as covered for the decoded path', () => {
    const nitro = createNitro({
      '/café/**': { ssr: false },
      '/café/secret': { ssr: true },
    })
    expect(isCovered(nitro, [{ path: '/café/:id()', file: 'cafe.vue' }]).get('/café/:id()')).toBe(false)
  })
})
