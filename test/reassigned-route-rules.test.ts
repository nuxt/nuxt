import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'

import { isNitroV3, runsOnceInMatrix } from './matrix'
import { fixturePath, setupFixture } from './utils'

const cacheDir = join(fixturePath('minimal'), 'node_modules/.cache/nuxt/reassigned-route-rules')

function rulesFor (prefix: string) {
  return {
    [`/${prefix}/headers`]: { headers: { 'x-reassigned': prefix } },
    [`/${prefix}/redirect`]: { redirect: { to: '/', statusCode: 302 as const } },
    [`/${prefix}/swr/:slug/about`]: { cache: { swr: true, maxAge: 60 } },
    [`/${prefix}/swr/:locale/:slug/about`]: { cache: { swr: true, maxAge: 60 } },
  }
}

const runs = runsOnceInMatrix && !isNitroV3

await setupFixture('minimal', runs, {
  nuxtConfig: {
    buildDir: join(cacheDir, 'build'),
    nitro: { output: { dir: join(cacheDir, 'output') } },
    routeRules: { '/prerendered': { prerender: true } },
    modules: [
      (_options, nuxt) => {
        nuxt.hook('nitro:init', (nitro) => {
          nitro.options.routeRules = { ...nitro.options.routeRules, ...rulesFor('init') }
        })
      },
      (_options, nuxt) => {
        nuxt.hook('nitro:init', (nitro) => {
          nitro.hooks.hook('prerender:done', () => {
            nitro.options.routeRules = { ...nitro.options.routeRules, ...rulesFor('done') }
          })
        })
      },
    ],
  },
})

describe.skipIf(!runs)('route rules reassigned by a module', () => {
  describe.each(['init', 'done'])('in `%s`', (prefix) => {
    it('applies a `headers` rule', async () => {
      const response = await fetch(`/${prefix}/headers`)
      expect(response.headers.get('x-reassigned')).toBe(prefix)
    })

    it('applies a `redirect` rule', async () => {
      const response = await fetch(`/${prefix}/redirect`, { redirect: 'manual' })
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('/')
    })

    it.each(['/a/about', '/en/a/about', '/a/about/_payload.json', '/en/a/about/_payload.json'])('caches `%s` under a sibling dynamic `swr` rule', async (path) => {
      const response = await fetch(`/${prefix}/swr${path}`)
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toContain('s-maxage=60')
    })
  })
})
