import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it } from 'vitest'
import { loadNuxt } from '../src/index.ts'

const pagesFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./pages-fixture', import.meta.url))))

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
    expect(nitro.options.routeRules['/route-rules/isr-spa/_payload.json']).toBeUndefined()

    // https://github.com/nuxt/nuxt/issues/34856
    expect(nitro.options.routeRules['/route-rules/swr-in-spa/_payload.json']).toMatchObject({
      ssr: true,
      cache: { swr: true },
    })

    await nuxt.close()
  })
})
