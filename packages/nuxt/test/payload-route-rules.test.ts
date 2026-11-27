import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it } from 'vitest'
import { defu } from 'defu'
import { createNormalizedRouteRulesRouter, normalizeRouteRuleLookupPath } from '@nuxt/kit/internal'
import type { NuxtConfig } from '@nuxt/schema'
import { loadNuxt } from '../src/index.ts'

const pagesFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./pages-fixture', import.meta.url))))

function resolvePathRules (nitro: any, path: string): Record<string, any> {
  const matcher = createNormalizedRouteRulesRouter(nitro.routing.routeRules.routes, '', true)
  return defu({}, ...matcher.matchAll('', normalizeRouteRuleLookupPath(path, true)).reverse())
}

const serverRules: NuxtConfig['routeRules'] = {
  '/**': { swr: 60 },
  '/admin': { redirect: '/login' },
  '/trailing/': { redirect: '/login' },
  '/users/:id/billing': { redirect: '/login' },
  '/internal': { proxy: 'http://127.0.0.1:4180/gated', headers: { 'x-frame-options': 'DENY' } },
  '/api-docs': { cors: true },
  '/account': { cache: false },
  '/orders': { isr: false },
  '/team/*': { cache: false },
  '/spa': { ssr: false },
  '/client/**': { ssr: false },
  '/client/stats': { swr: 30 },
  '/old/**': { redirect: '/new/**' },
  '/old/kept': { redirect: false },
  '/docs/**:slug': { headers: { 'x-docs': '1' } },
  '/plain': { noScripts: true },
}

describe('payload route rules', () => {
  it('generates payload route rules only for routes that can be server-rendered', async () => {
    const nuxt = await loadNuxt({
      cwd: pagesFixtureDir,
      ready: true,
      overrides: {
        routeRules: {
          '/route-rules/isr-spa': { isr: 60, ssr: false },
          '/route-rules/swr-in-spa/**': { ssr: false },
          '/route-rules/swr-in-spa': { ssr: true, swr: 60 },
        },
      },
    })

    const nitro = (nuxt as any)._nitro
    await nitro.hooks.callHook('build:before', nitro)

    expect(nitro.options.routeRules['/route-rules/isr-spa']).toMatchObject({
      isr: 60,
      ssr: false,
    })
    expect(resolvePathRules(nitro, '/route-rules/isr-spa/_payload.json')).toMatchObject({ ssr: false })

    // https://github.com/nuxt/nuxt/issues/34856
    expect(nitro.options.routeRules['/route-rules/swr-in-spa/_payload.json']).toMatchObject({
      ssr: true,
      cache: { swr: true },
    })

    await nuxt.close()
  })

  it('generates payload route rules only for method-scoped rules that apply to page requests', async () => {
    const nuxt = await loadNuxt({
      cwd: pagesFixtureDir,
      ready: true,
      overrides: {
        routeRules: {
          'GET /route-rules/get-swr': { swr: 60 },
          'POST /route-rules/post-swr': { swr: 60 },
          '/route-rules/get-opt-out': { swr: 60 },
          'GET /route-rules/get-opt-out': { cache: false },
          '/route-rules/get-spa': { swr: 60 },
          'GET /route-rules/get-spa': { ssr: false },
        },
      },
    })

    const nitro = (nuxt as any)._nitro
    await nitro.hooks.callHook('build:before', nitro)

    expect(nitro.options.routeRules['/route-rules/get-swr/_payload.json']).toMatchObject({
      ssr: true,
      cache: { swr: true },
    })
    expect(Object.keys(nitro.options.routeRules).filter(key => key.includes('post-swr'))).toEqual(['POST /route-rules/post-swr'])
    expect(resolvePathRules(nitro, '/route-rules/get-opt-out/_payload.json')).toMatchObject({ cache: false })
    expect(resolvePathRules(nitro, '/route-rules/get-spa/_payload.json')).toMatchObject({ ssr: false })

    await nuxt.close()
  })

  it('applies the server rules of a route to its payload url', async () => {
    const nuxt = await loadNuxt({
      cwd: pagesFixtureDir,
      ready: true,
      overrides: { routeRules: serverRules },
    })

    const nitro = (nuxt as any)._nitro
    await nitro.hooks.callHook('build:before', nitro)

    expect(resolvePathRules(nitro, '/admin/_payload.json')).toMatchObject({ redirect: { to: '/login' } })
    expect(resolvePathRules(nitro, '/users/alice/billing/_payload.json')).toMatchObject({ redirect: { to: '/login' } })
    expect(resolvePathRules(nitro, '/trailing/_payload.json')).toMatchObject({ redirect: { to: '/login' } })
    expect(resolvePathRules(nitro, '/internal/_payload.json')).toMatchObject({
      proxy: { to: 'http://127.0.0.1:4180/gated' },
      headers: { 'x-frame-options': 'DENY' },
    })
    expect(resolvePathRules(nitro, '/api-docs/_payload.json')).toHaveProperty('cors', {})
    expect(resolvePathRules(nitro, '/account/_payload.json')).toMatchObject({ cache: false })
    expect(resolvePathRules(nitro, '/orders/_payload.json')).toMatchObject({ isr: false })
    expect(resolvePathRules(nitro, '/team/a/_payload.json')).toMatchObject({ cache: false })
    expect(resolvePathRules(nitro, '/spa/_payload.json')).toMatchObject({ ssr: false })
    expect(resolvePathRules(nitro, '/client/stats/_payload.json')).toMatchObject({ ssr: false })
    expect(resolvePathRules(nitro, '/old/kept/_payload.json').redirect).toBe(false)
    expect(resolvePathRules(nitro, '/other/_payload.json')).toMatchObject({ cache: { swr: true, maxAge: 60 } })

    expect(nitro.options.routeRules['/plain/_payload.json']).toBeUndefined()
    expect(nitro.options.routeRules['/__nuxt_error/_payload.json']).toBeUndefined()
    expect(nitro.options.routeRules['/client/**/_payload.json']).toBeUndefined()
    expect(nitro.options.routeRules['/docs/**:slug/_payload.json']).toBeUndefined()

    await nuxt.close()
  })
})
