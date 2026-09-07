import { describe, expect, it } from 'vitest'
import { defu } from 'defu'
import { loadOptions } from 'nitropack/core'
import { addRoute, createRouter, findAllRoutes } from 'rou3'

import { createRouteRulesRouter, normalizeRouteRules } from '../../nuxt/src/core/utils/route-rules.ts'

/** Route rules as authored: each normaliser accepts a superset of what the other spells. */
type AuthoredRules = Record<string, Record<string, any>>

/**
 * Nitro's own rules, as it resolves them. It does not export its normaliser, and it spells the
 * redirect status and the subtree a `/**` redirect moves differently, so those are translated
 * onto the shape Nuxt's normaliser produces; the shorthands it leaves alongside the `cache`
 * rule it expanded are dropped.
 */
async function normalizeWithNitro (config: AuthoredRules) {
  const { routeRules } = await loadOptions({ routeRules: config as any })
  const normalized: Record<string, Record<string, any>> = {}
  for (const [route, rules] of Object.entries(routeRules)) {
    const { redirect, proxy, swr, isr, ...rest } = rules as Record<string, any>
    normalized[route] = rest
    if (redirect) {
      const { statusCode, _redirectStripBase, ...target } = redirect
      normalized[route]!.redirect = {
        status: statusCode,
        ...target,
        ..._redirectStripBase ? { base: _redirectStripBase } : {},
      }
    }
  }
  return normalized
}

function createMatcher (rules: Record<string, Record<string, any>>, baseURL = '') {
  const router = createRouter<Record<string, any>>()
  for (const [route, data] of Object.entries(rules)) {
    addRoute(router, '', baseURL + route, data)
  }
  return (path: string) => defu({}, ...findAllRoutes(router, '', path).map(r => r.data).reverse()) as Record<string, any>
}

function matchWithNuxt (config: AuthoredRules, baseURL = '') {
  const router = createRouteRulesRouter(
    Object.entries(normalizeRouteRules(config as Parameters<typeof normalizeRouteRules>[0])).map(([route, data]) => ({ route, method: '', data })),
    baseURL,
  )
  return (path: string) => defu({}, ...router.matchAll('', path).reverse()) as Record<string, any>
}

const rules = {
  '/**': { ssr: true },
  '/spa': { ssr: false },
  '/spa/**': { ssr: false, noScripts: true },
  '/old': { redirect: '/new' },
  '/moved/**': { redirect: { to: '/new', status: 301 } },
  '/blog/:slug': { prerender: true },
  '/blog/:slug/comments': { ssr: false },
  '/cached': { swr: 60 },
  '/isr': { cache: { maxAge: 30 } },
  '/isr/off': { cache: false },
  '/trailing/': { prerender: true },
  '/mixed/**': { headers: { 'x-a': '1' } },
  '/mixed/inner': { headers: { 'x-b': '2' }, prerender: false },
} satisfies AuthoredRules

function compileMatcher (baseURL: string) {
  const router = createRouteRulesRouter([{ route: '/**', method: '', data: { ssr: false } }], baseURL)
  return new Function(`return ${router.compileToString({ matchAll: true })}`)() as (method: string, path: string) => Array<{ data: unknown }>
}

const paths = [
  '/',
  '/spa',
  '/spa/',
  '/spa/deep/page',
  '/old',
  '/moved/page',
  '/blog/hello',
  '/blog/hello/comments',
  '/cached',
  '/isr',
  '/isr/off',
  '/trailing',
  '/trailing/',
  '/mixed/inner',
  '/mixed/other',
  '/unmatched/path',
]

describe('route rule compiler', () => {
  it('matches the rules nitro would match', async () => {
    const nitro = createMatcher(await normalizeWithNitro(rules))
    const nuxt = matchWithNuxt(rules)
    for (const path of paths) {
      expect.soft(nuxt(path), path).toEqual(nitro(path))
    }
  })

  it('matches the rules nitro would match under a base URL', async () => {
    const nitro = createMatcher(await normalizeWithNitro(rules), '/base')
    const nuxt = matchWithNuxt(rules, '/base')
    for (const path of paths) {
      expect.soft(nuxt('/base' + path), path).toEqual(nitro('/base' + path))
    }
  })

  it('compiles a lone catch-all to its rules', () => {
    const match = compileMatcher('')

    expect(match('', '/any/path')[0]!.data).toEqual({ ssr: false })
  })

  it('compiles a lone catch-all under a base URL to match only under it', () => {
    const match = compileMatcher('/base')

    expect(match('', '/base/any/path')[0]!.data).toEqual({ ssr: false })
    expect(match('', '/elsewhere')).toEqual([])
  })
})
