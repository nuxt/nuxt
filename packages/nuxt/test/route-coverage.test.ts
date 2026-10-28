import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it } from 'vitest'
import type { Nitro, RouteRuleConfig } from 'nitro/types'
import type { NitroInstance, NuxtPage } from 'nuxt/schema'

import { loadNuxt } from '../src/index.ts'
import { markPagesCoveredByRouteRule } from '../src/pages/route-coverage.ts'

function createNitro (rules: Record<string, RouteRuleConfig>) {
  const routes = Object.entries(rules).map(([route, data]) => ({ route, method: '', data }))
  return {
    routing: { routeRules: { routes } },
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

const pagesFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./pages-fixture', import.meta.url))))

describe('markPagesCoveredByRouteRule', () => {
  it('should not report coverage from a literal rule matching the probe segment', () => {
    const nitro = createNitro({
      '/**': { ssr: true },
      '/__nuxt_route_rule_probe__': { ssr: false },
    })
    expect(isCovered(nitro, [{ path: '/:slug()', file: 'slug.vue' }]).get('/:slug()')).toBe(false)
  })

  it('should not report coverage for an unconstrained page from a constrained route rule', () => {
    const nitro = createNitro({
      '/foo/:x([a-z_]+)': { ssr: false },
    })
    expect(isCovered(nitro, [{ path: '/foo/:x()', file: 'x.vue' }]).get('/foo/:x()')).toBe(false)
  })

  it('should report coverage for an unconstrained page from an unconstrained route rule', () => {
    const nitro = createNitro({
      '/foo/:x': { ssr: false },
    })
    expect(isCovered(nitro, [{ path: '/foo/:x()', file: 'x.vue' }]).get('/foo/:x()')).toBe(true)
  })

  it('should not report coverage when a constrained route rule carves out part of the region', () => {
    const nitro = createNitro({
      '/foo/**': { ssr: false },
      '/foo/:x([0-9]+)': { ssr: true },
    })
    expect(isCovered(nitro, [{ path: '/foo/:x()', file: 'x.vue' }]).get('/foo/:x()')).toBe(false)
  })

  it('should not report coverage for a constrained page from a constrained route rule', () => {
    const nitro = createNitro({
      '/foo/:x([a-z_]+)': { ssr: false },
    })
    expect(isCovered(nitro, [{ path: '/foo/:x([a-z_]+)', file: 'x.vue' }]).get('/foo/:x([a-z_]+)')).toBe(false)
  })

  it('should treat an escaped colon as a literal segment rather than a param', () => {
    const nitro = createNitro({
      '/test\\:name': { ssr: false },
    })
    expect(isCovered(nitro, [{ path: '/test\\:name', file: 'test.vue' }]).get('/test\\:name')).toBe(true)
  })

  it('should report coverage when app.baseURL is set', async () => {
    let nitro: NitroInstance | undefined
    const nuxt = await loadNuxt({
      cwd: pagesFixtureDir,
      ready: true,
      overrides: {
        app: { baseURL: '/sub/' },
        routeRules: { '/admin/**': { ssr: false } },
        modules: [
          (_options, nuxt) => {
            nuxt.hook('nitro:init', (n) => { nitro = n })
          },
        ],
      },
    })
    try {
      expect(nitro).toBeDefined()
      const marks = new Map<string, boolean>()
      markPagesCoveredByRouteRule([{ path: '/admin', file: 'admin.vue' }], nitro!, {
        isCovered: rules => rules.ssr === false,
        mark: (_page, covered, resolvedPath) => { marks.set(resolvedPath, covered) },
      })
      expect(marks.get('/admin')).toBe(true)
    } finally {
      await nuxt.close()
    }
  })

  it('should match pages against percent-encoded route rule keys', async () => {
    let nitro: Nitro | undefined
    const nuxt = await loadNuxt({
      cwd: pagesFixtureDir,
      ready: false,
      overrides: {
        routeRules: {
          '/café/**': { ssr: false },
          '/café/secret': { ssr: true },
        },
      },
    })
    nuxt.hook('nitro:init', (instance) => { nitro = instance as Nitro })
    try {
      await nuxt.ready()
      const marks = isCovered(nitro!, [
        { path: '/café/about', file: 'about.vue' },
        { path: '/caf%C3%A9/contact', file: 'contact.vue' },
        { path: '/café/:id()', file: 'id.vue' },
      ])
      expect(Object.fromEntries(marks)).toEqual({
        '/café/about': true,
        '/caf%C3%A9/contact': true,
        '/café/:id()': false,
      })
    } finally {
      await nuxt.close()
    }
  })

  it('should apply method-scoped rules that match a page request', () => {
    const nitro = createNitro({
      '/admin/**': { ssr: false },
      'GET /admin/settings': { ssr: true },
      'GET /dashboard/**': { ssr: false },
      'POST /dashboard/**': { ssr: true },
    })
    const marks = isCovered(nitro, [
      { path: '/admin/settings', file: 'settings.vue' },
      { path: '/admin/:id()', file: 'admin.vue' },
      { path: '/dashboard', file: 'dashboard.vue', children: [{ path: ':id()', file: 'id.vue' }] },
    ])
    expect(marks.get('/admin/settings')).toBe(false)
    expect(marks.get('/admin/:id()')).toBe(false)
    expect(marks.get('/dashboard')).toBe(true)
    expect(marks.get('/dashboard/:id()')).toBe(true)
  })
})
