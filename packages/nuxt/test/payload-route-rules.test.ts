import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it } from 'vitest'
import type { NuxtConfig } from '@nuxt/schema'
import { loadNuxt } from '../src/index.ts'
import { createNormalizedRouteRulesRouter, resolveRouteRules } from '../src/core/utils/route-rules.ts'

const pagesFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./pages-fixture', import.meta.url))))

function resolvePathRules (nitro: any, path: string): Record<string, any> {
  const matcher = createNormalizedRouteRulesRouter(Object.entries(nitro.options.routeRules).map(([route, data]) => ({ route, data: data as Record<string, any> })), '', true)
  return resolveRouteRules(matcher, path, true)
}

const cacheExclusionRules: NuxtConfig['routeRules'] = {
  '/**': { isr: 60 },
  '/account': { isr: false },
  '/orders': { cache: false },
  '/user/:id': { isr: false },
  '/team/*': { isr: false },
  '/spa': { ssr: false },
  '/spa-private': { ssr: false, isr: false },
  '/admin/**': { ssr: false },
  '/admin/stats': { swr: 60 },
  '/admin/settings': { headers: { 'x-admin': '1' } },
  '/blog': { isr: 120 },
  '/docs/**:slug': { isr: 120 },
  '/private': { redirect: '/login' },
  '/trailing/': { redirect: '/login' },
  '/users/:id/billing': { redirect: '/login' },
  '/internal': { proxy: 'http://127.0.0.1:4180/gated', headers: { 'x-frame-options': 'DENY' } },
  '/api-docs': { cors: true },
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
          // https://github.com/nuxt/nuxt/issues/34715
          '/swr-dynamic/:slug/about': { swr: 60 },
          '/swr-dynamic/:slug/about/_payload.json': { cache: false },
          '/swr-dynamic/:locale/:slug/about': { swr: 60 },
          '/swr-optional/:slug?/about': { swr: 60 },
          '/swr-constrained/:id(\\d+)/about': { swr: 60 },
        },
      },
    })

    const nitro = (nuxt as any)._nitro
    await nitro.hooks.callHook('build:before', nitro)

    expect(nitro.options.routeRules['/route-rules/isr-spa']).toMatchObject({
      isr: 60,
      ssr: false,
    })
    expect(nitro.options.routeRules['/route-rules/isr-spa/_payload.json']).toEqual({ ssr: false, isr: 60 })
    expect(nitro.options.routeRules['/route-rules/isr-spa/_payload.js']).toBeUndefined()

    // https://github.com/nuxt/nuxt/issues/34856
    expect(nitro.options.routeRules['/route-rules/swr-in-spa/_payload.json']).toMatchObject({
      ssr: true,
      cache: { swr: true },
    })

    expect(nitro.options.routeRules['/swr-dynamic/:slug/about/_payload.json']).toMatchObject({
      ssr: true,
      cache: false,
    })
    expect(nitro.options.routeRules['/swr-dynamic/:locale/:slug/about/_payload.json']).toMatchObject({
      ssr: true,
      cache: { swr: true },
    })

    expect(nitro.options.routeRules['/swr-optional/:slug?/about/_payload.json']).toMatchObject({
      ssr: true,
      cache: { swr: true },
    })
    expect(nitro.options.routeRules['/swr-constrained/:id(\\d+)/about/_payload.json']).toMatchObject({
      ssr: true,
      cache: { swr: true },
    })

    await nuxt.close()
  })

  it.for(['_payload.json', '_payload.js'])('applies the server rules of a route to its %s url', async (payloadFile) => {
    const nuxt = await loadNuxt({
      cwd: pagesFixtureDir,
      ready: true,
      overrides: {
        experimental: { renderJsonPayloads: payloadFile === '_payload.json' },
        routeRules: cacheExclusionRules,
      },
    })

    const nitro = (nuxt as any)._nitro
    await nitro.hooks.callHook('build:before', nitro)

    expect(resolvePathRules(nitro, `/account/${payloadFile}`)).toMatchObject({ isr: false })
    expect(resolvePathRules(nitro, `/orders/${payloadFile}`)).toMatchObject({ cache: false })
    expect(resolvePathRules(nitro, `/user/1/${payloadFile}`)).toMatchObject({ isr: false })
    expect(resolvePathRules(nitro, `/team/a/${payloadFile}`)).toMatchObject({ isr: false })
    expect(resolvePathRules(nitro, `/spa/${payloadFile}`)).toMatchObject({ ssr: false })
    expect(resolvePathRules(nitro, `/spa-private/${payloadFile}`)).toMatchObject({ ssr: false, isr: false })
    expect(resolvePathRules(nitro, `/admin/stats/${payloadFile}`)).toMatchObject({ ssr: false })
    expect(resolvePathRules(nitro, `/blog/${payloadFile}`)).toMatchObject({ ssr: true, isr: 120 })
    expect(resolvePathRules(nitro, `/other/${payloadFile}`)).toMatchObject({ isr: 60 })
    expect(resolvePathRules(nitro, `/admin/settings/${payloadFile}`)).toMatchObject({ ssr: false, headers: { 'x-admin': '1' } })
    expect(resolvePathRules(nitro, `/private/${payloadFile}`)).toMatchObject({ redirect: { to: '/login' } })
    expect(resolvePathRules(nitro, `/users/alice/billing/${payloadFile}`)).toMatchObject({ redirect: { to: '/login' } })
    expect(resolvePathRules(nitro, `/trailing/${payloadFile}`)).toMatchObject({ redirect: { to: '/login' } })
    expect(resolvePathRules(nitro, `/internal/${payloadFile}`)).toMatchObject({
      proxy: { to: 'http://127.0.0.1:4180/gated' },
      headers: { 'x-frame-options': 'DENY' },
    })
    expect(resolvePathRules(nitro, `/api-docs/${payloadFile}`)).toMatchObject({ cors: true })

    expect(nitro.options.routeRules[`/docs/**:slug/${payloadFile}`]).toBeUndefined()

    await nuxt.close()
  })
})
