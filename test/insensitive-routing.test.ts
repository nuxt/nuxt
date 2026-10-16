import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev, nitroViteEnvironment, runsOncePerEnvInMatrix } from './matrix'
import { parseData } from './utils'

const shouldRun = runsOncePerEnvInMatrix || nitroViteEnvironment

if (shouldRun) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/insensitive-routing', import.meta.url)),
    dev: isDev,
    server: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!shouldRun)('server route rules with `sensitive: false`', () => {
  const variants = {
    casing: {
      redirect: ['/Redirect', '/REDIRECT'],
      headers: ['/Headers/a', '/HEADERS/a'],
      mixedCase: ['/mixed-case', '/MIXED-CASE'],
      proxy: ['/Proxy', '/PROXY'],
      spa: ['/Spa', '/SPA'],
      noScripts: ['/No-Scripts', '/NO-SCRIPTS'],
      rules: ['/Rules', '/RULES'],
    },
    encoding: {
      redirect: ['/%72edirect', '/%52edirect'],
      headers: ['/h%65aders/a', '/%48eaders/a'],
      mixedCase: ['/%4Dixed-Case', '/%6dixed-case'],
      proxy: ['/%70roxy', '/%50roxy'],
      spa: ['/%73pa', '/%53pa'],
      noScripts: ['/%6Eo-scripts', '/%4Eo-scripts'],
      rules: ['/%72ules', '/%52ules'],
    },
  }

  describe.each(Object.entries(variants))('regardless of request %s', (_, paths) => {
    it('should apply `redirect`', async () => {
      for (const path of ['/redirect', ...paths.redirect]) {
        const res = await fetch(path, { redirect: 'manual' })
        expect(res.status, path).toBe(307)
        expect(res.headers.get('location'), path).toBe('/')
      }
    })

    it('should apply `headers`', async () => {
      for (const path of ['/headers/a', ...paths.headers]) {
        const res = await fetch(path)
        expect(res.status, path).toBe(200)
        expect(res.headers.get('x-route-rule'), path).toBe('headers')
      }
    })

    it('should apply a rule with a mixed-case key', async () => {
      for (const path of ['/Mixed-Case', ...paths.mixedCase]) {
        const res = await fetch(path)
        expect(res.status, path).toBe(200)
        expect(res.headers.get('x-route-rule'), path).toBe('mixed-case')
      }
    })

    it('should apply `proxy`', async () => {
      for (const path of ['/proxy', ...paths.proxy]) {
        expect(await $fetch<string>(path), path).toBe('proxied')
      }
    })

    it('should apply `ssr: false`', async () => {
      for (const path of ['/spa', ...paths.spa]) {
        const { script } = parseData(await $fetch<string>(path))
        expect(script.serverRendered, path).toBe(false)
      }
    })

    it('should apply `noScripts`', async () => {
      for (const path of ['/no-scripts', ...paths.noScripts]) {
        const html = await $fetch<string>(path)
        const scripts = html.match(/<script[^>]*>/g) ?? []
        expect(scripts.every(tag => tag.includes('type="speculationrules"')), path).toBe(true)
      }
    })

    it('should resolve `getRouteRules(event)`', async () => {
      for (const path of ['/rules', ...paths.rules]) {
        expect(await $fetch(`${path}?rules`), path).toMatchObject({ headers: { 'x-route-rule': 'rules' } })
      }
    })

    it('should resolve `matchRouteRules(path)`', async () => {
      for (const path of ['/rules', ...paths.rules]) {
        expect(await $fetch('/api/match', { query: { path } }), path).toMatchObject({ headers: { 'x-route-rule': 'rules' } })
      }
    })
  })
})
