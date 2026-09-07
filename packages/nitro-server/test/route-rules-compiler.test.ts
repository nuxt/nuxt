import { describe, expect, it } from 'vitest'
import { defu } from 'defu'
import { normalizeRouteRules as normalizeWithH3 } from 'h3/rules'
import { addRoute, createRouter, findAllRoutes } from 'rou3'
import type { RouteRuleConfig } from 'nuxt/schema'

import { createRouteRulesRouter, normalizeRouteRules } from '../../nuxt/src/core/utils/route-rules.ts'

/** Nitro's own matcher: h3-normalised rules in a rou3 router, merged most-specific-last. */
function matchWithNitro (config: Record<string, RouteRuleConfig>, baseURL = '') {
  const router = createRouter<Record<string, any>>()
  for (const [route, rules] of Object.entries(normalizeWithH3(config as any))) {
    addRoute(router, '', baseURL + route, rules)
  }
  return (path: string) => defu({}, ...findAllRoutes(router, '', path).map(r => r.data).reverse()) as Record<string, any>
}

function matchWithNuxt (config: Record<string, RouteRuleConfig>, baseURL = '') {
  const router = createRouteRulesRouter(
    Object.entries(normalizeRouteRules(config)).map(([route, data]) => ({ route, method: '', data })),
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
  '/cached/off': { swr: false },
  '/isr': { cache: { maxAge: 30 } },
  '/isr/off': { cache: false },
  '/trailing/': { prerender: true },
  '/mixed/**': { headers: { 'x-a': '1' } },
  '/mixed/inner': { headers: { 'x-b': '2' }, prerender: false },
} satisfies Record<string, RouteRuleConfig>

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
  '/cached/off',
  '/isr',
  '/isr/off',
  '/trailing',
  '/trailing/',
  '/mixed/inner',
  '/mixed/other',
  '/unmatched/path',
]

describe('route rule compiler', () => {
  it('matches the rules nitro would match', () => {
    const nitro = matchWithNitro(rules)
    const nuxt = matchWithNuxt(rules)
    for (const path of paths) {
      expect.soft(nuxt(path), path).toEqual(nitro(path))
    }
  })

  it('matches the rules nitro would match under a base URL', () => {
    const nitro = matchWithNitro(rules, '/base')
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
