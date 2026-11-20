import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pageDiagnostics } from '@nuxt/kit/internal'
import { tryUseNitro } from '@nuxt/kit'
import type { NuxtConfig } from 'nuxt/schema'

import { loadNuxt } from '../src/index.ts'
import { routeRulesTemplate } from '../src/core/templates.ts'
import { findChangedRouteRuleKeyPart, getRouteRulesMatching } from '../src/core/utils/route-rules.ts'

const pagesFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./pages-fixture', import.meta.url))))

const changedKeys: Record<string, string> = {
  '/foo/*': '*',
  '/*': '*',
  'foo/*': '*',
  '/foo/file.*': '*',
  '/foo/a*': '*',
  '/foo/*/end': '*',
  '/foo/:id(.*)': ':id(.*)',
  '/foo/**/end': '**/end',
  '/foo/**:name/end': '**:name/end',
  '/foo/:user-id': ':user-id',
  '/foo/:a-:b': ':a-',
}

const unchangedKeys = [
  '/foo',
  '/foo/',
  '/foo/**',
  '/foo/**/',
  '/foo/**:name',
  '/foo/:id',
  '/foo/:id?',
  '/foo/:id+',
  '/foo/:id*',
  '/foo/:id(\\d+)',
  '/foo/:id(\\d+)?',
  '/foo/:id([a-z*]+)',
  '/foo/:id/end',
  '/foo/:id?/end',
  '/foo/file.:ext',
  '/foo/\\*',
  '/book{s}?',
  '/users{/:id}?/posts',
]

const probePaths = ['/', '/foo', '/foo/', '/foo/a', '/foo/a/', '/foo/a/b', '/foo/a/b/c', '/foo/end', '/foo/a/end', '/foo/a/b/end', '/foo/a-id', '/foo/a-b', '/foo/abc', '/foo/12', '/foo/file.txt', '/foo/file.txt/a', '/foo/*', '/book', '/books', '/users/posts', '/users/1/posts', '/a', '/a/b']

function matchedPaths (nitroMajor: 2 | 3, key: string) {
  const matching = getRouteRulesMatching({ options: { _nitroMajor: nitroMajor } })
  const router = matching.createRouter([{ route: key, data: { matched: true } }], true)
  return probePaths.filter(path => matching.resolveRouteRules(router, path, true).matched)
}

describe('route rule keys whose meaning changed on Nitro v3', () => {
  it.each(Object.entries(changedKeys))('finds `%s` changed at `%s`', (key, part) => {
    expect(findChangedRouteRuleKeyPart(key)).toBe(part)
    expect(matchedPaths(3, key)).not.toEqual(matchedPaths(2, key))
  })

  it.each(unchangedKeys)('finds `%s` unchanged', (key) => {
    expect(findChangedRouteRuleKeyPart(key)).toBeUndefined()
    expect(matchedPaths(3, key)).toEqual(matchedPaths(2, key))
  })

  it('reads the path of a method-scoped key', () => {
    expect(findChangedRouteRuleKeyPart('GET /foo/*')).toBe('*')
    expect(findChangedRouteRuleKeyPart('POST /foo/**')).toBeUndefined()
  })
})

describe('route pattern matcher', () => {
  it('matches link targets in the pattern syntax of the Nitro major', () => {
    const patterns = ['/pages/:slug', '/old/*']
    const v3 = getRouteRulesMatching({ options: { _nitroMajor: 3 } }).createPatternMatcher(patterns, true)
    const nitropack = getRouteRulesMatching({ options: { _nitroMajor: 2 } }).createPatternMatcher(patterns, true)
    expect(['/pages/a', '/Old/a', '/old/a/b', '/pages/a/b'].map(v3)).toEqual([true, true, true, false])
    expect(['/pages/a', '/Old/a', '/old/a/b', '/pages/a/b'].map(nitropack)).toEqual([true, true, false, false])
  })
})

describe('route rule key warning', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function generate (nitroMajor: 2 | 3, overrides: NuxtConfig = {}, beforeSecondPass?: () => Promise<void>) {
    const warn = vi.spyOn(pageDiagnostics, 'NUXT_B4029').mockReturnValue(undefined as never)
    const nuxt = await loadNuxt({
      cwd: pagesFixtureDir,
      ready: true,
      overrides: {
        _nitroMajor: nitroMajor,
        routeRules: {
          '/config/*': { ssr: false },
          '/headers/*': { headers: { 'x-test': '1' } },
          '/unchanged/**': { ssr: false },
          '/named/:id': { ssr: false },
        },
        modules: [
          (_options, nuxt) => {
            nuxt.options.routeRules!['/module/*'] = { ssr: false }
            nuxt.hook('nitro:config', (config) => {
              config.routeRules!['/hook/**/end'] = { ssr: false }
            })
          },
        ],
        ...overrides,
      },
    })
    try {
      const contents = () => routeRulesTemplate.getContents!({ nuxt, app: undefined!, options: {} })
      await contents()
      await contents()
      if (beforeSecondPass) {
        await beforeSecondPass()
        await contents()
      }
    } finally {
      await nuxt.close()
    }
    return warn.mock.calls.map(([params]) => params)
  }

  it('reports each changed key once on Nitro v3, including keys a module adds', async () => {
    expect(await generate(3)).toEqual([
      { route: '/config/*', part: '*' },
      { route: '/headers/*', part: '*' },
      { route: '/module/*', part: '*' },
      { route: '/hook/**/end', part: '**/end' },
    ])
  })

  it('reports a changed key added after the first pass', async () => {
    const calls = await generate(3, {}, async () => {
      const nitro = tryUseNitro()!
      await nitro.updateConfig({ routeRules: { ...nitro.options.routeRules, '/late/:user-id': { ssr: false } } })
    })
    expect(calls.map(({ route }) => route)).toEqual(['/config/*', '/headers/*', '/module/*', '/hook/**/end', '/late/:user-id'])
  })

  it('reports nothing on nitropack', async () => {
    expect(await generate(2)).toEqual([])
  })
})
