import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it } from 'vitest'
import type { NuxtApp } from 'nuxt/schema'
import { loadNuxt } from '../src/index.ts'

const fixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./inline-route-rules-fixture', import.meta.url))))

describe('inline route rules', () => {
  it('keeps route rules added by nitro when merging page rules', async () => {
    const nuxt = await loadNuxt({ cwd: fixtureDir, ready: true, overrides: { dev: false } })
    try {
      const nitro = (nuxt as any)._nitro
      const assetRules = Object.keys(nitro.options.routeRules).filter(route => route.startsWith('/_nuxt/'))
      expect(assetRules.length).toBeGreaterThan(0)

      await nuxt.callHook('app:templates', {} as NuxtApp)

      expect(nitro.options.routeRules['/']).toMatchObject({ headers: { 'x-from-page': 'index' } })
      for (const route of assetRules) {
        expect(nitro.options.routeRules[route]).toMatchObject({
          headers: { 'cache-control': expect.stringContaining('immutable') },
        })
      }
    } finally {
      await nuxt.close()
    }
  })

  it('merges page rules onto configured route rules', async () => {
    const nuxt = await loadNuxt({ cwd: fixtureDir, ready: true, overrides: { dev: false } })
    try {
      const nitro = (nuxt as any)._nitro
      nitro.options.routeRules['/uncached'].headers = { 'x-module': 'kept' }
      nitro.options.routeRules['/moved'].appMiddleware = { config: true }
      nitro.options.routeRules['/cached'].appMiddleware = ['module']
      nitro.options.routeRules['/'] = { cache: false }
      nuxt.hook('pages:resolved', (pages) => {
        for (const page of pages) {
          if (page.path === '/') {
            page.rules = { ...page.rules, swr: 60 } as typeof page.rules
          }
          if (page.path === '/moved' || page.path === '/cached') {
            page.rules = { ...page.rules, appMiddleware: ['page'] } as typeof page.rules
          }
        }
      })
      await nuxt.callHook('app:templates', {} as NuxtApp)

      expect(nitro.options.routeRules['/'].cache).toMatchObject({ swr: true, maxAge: 60 })
      expect(nitro.options.routeRules['/uncached']).toMatchObject({ cache: false, headers: { 'x-module': 'kept' } })
      expect(nitro.options.routeRules['/cached']).toMatchObject({
        cache: { swr: false, maxAge: 5 },
        appMiddleware: { module: true, page: true },
      })
      expect(nitro.options.routeRules['/moved']).toMatchObject({
        redirect: { to: '/', status: 301 },
        appMiddleware: { config: true, page: true },
      })
    } finally {
      await nuxt.close()
    }
  })

  it('restores nitro route rules when page rules are removed', async () => {
    const nuxt = await loadNuxt({ cwd: fixtureDir, ready: true, overrides: { dev: false } })
    try {
      const nitro = (nuxt as any)._nitro
      nitro.options.routeRules['/uncached'].headers = { 'x-module': 'kept' }

      const app = nuxt.apps.default ||= {} as NuxtApp
      await nuxt.callHook('app:templates', app)
      expect(nitro.options.routeRules['/']).toBeDefined()
      expect(nitro.options.routeRules['/uncached'].cache).toBe(false)

      nuxt.hook('pages:resolved', (pages) => {
        for (const page of pages) {
          delete page.rules
        }
      })
      await nuxt.callHook('builder:watch', 'change', 'pages/index.vue')
      expect(nitro.options.routeRules['/']).toBeUndefined()
      expect(nitro.options.routeRules['/uncached']).toMatchObject({ cache: { swr: true, maxAge: 60 }, headers: { 'x-module': 'kept' } })
    } finally {
      await nuxt.close()
    }
  })
})
