import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { join } from 'pathe'
import { resolveModulePath } from 'exsolve'
import { createMatcherFromFind } from 'h3/rules'
import { compileRouteRules } from 'h3/rules/compiler'
import type { Nitro, NitroConfig } from 'nitro/types'
import { normalizeLegacyRouteRules, routeRulesCaseFoldPlugin } from '../src/route-rules.ts'

vi.mock('@nuxt/kit/internal', () => ({
  bundlerDiagnostics: { NUXT_B7026: vi.fn() },
  pageDiagnostics: { NUXT_B4022: vi.fn((p: { route: string, part: string }) => new Error(`NUXT_B4022 ${p.route} ${p.part}`)) },
}))

const { bundlerDiagnostics } = await import('@nuxt/kit/internal')

function normalize (routeRules: NitroConfig['routeRules']) {
  vi.mocked(bundlerDiagnostics.NUXT_B7026).mockClear()
  normalizeLegacyRouteRules(routeRules)
  return { routeRules, warnings: vi.mocked(bundlerDiagnostics.NUXT_B7026).mock.calls.map(c => c[0]) }
}

describe('normalizeLegacyRouteRules', () => {
  it('rewrites `statusCode` to `status` and warns', () => {
    const { routeRules, warnings } = normalize({ '/old': { redirect: { to: '/new', statusCode: 302 } as any } })

    expect(routeRules!['/old']!.redirect).toEqual({ to: '/new', status: 302 })
    expect(warnings).toEqual([{ route: '/old' }])
  })

  it('leaves a rule that already uses `status` alone', () => {
    const { routeRules, warnings } = normalize({ '/keep': { redirect: { to: '/other', status: 301 } } })

    expect(routeRules!['/keep']!.redirect).toEqual({ to: '/other', status: 301 })
    expect(warnings).toEqual([])
  })

  it('leaves a shorthand redirect alone', () => {
    const { routeRules, warnings } = normalize({ '/plain': { redirect: '/somewhere' } })

    expect(routeRules!['/plain']!.redirect).toBe('/somewhere')
    expect(warnings).toEqual([])
  })

  it('prefers `status` when a rule sets both', () => {
    const { routeRules } = normalize({ '/both': { redirect: { to: '/x', status: 307, statusCode: 302 } as any } })

    expect(routeRules!['/both']!.redirect).toEqual({ to: '/x', status: 307 })
  })

  it('warns once per affected route', () => {
    const { warnings } = normalize({
      '/a': { redirect: { to: '/1', statusCode: 302 } as any },
      '/b': { redirect: { to: '/2', statusCode: 301 } as any },
      '/c': { redirect: { to: '/3', status: 302 } },
    })

    expect(warnings).toEqual([{ route: '/a' }, { route: '/b' }])
  })

  it('tolerates absent or empty route rules', () => {
    expect(() => normalizeLegacyRouteRules(undefined)).not.toThrow()
    expect(() => normalizeLegacyRouteRules({})).not.toThrow()
    expect(() => normalizeLegacyRouteRules({ '/x': {} })).not.toThrow()
  })
})

describe('routeRulesCaseFoldPlugin', () => {
  const nitroPackage = resolveModulePath('nitro/package.json', { from: import.meta.url })

  async function loadMatcher (routeRules: NonNullable<NitroConfig['routeRules']>, baseURL = '/') {
    const options = { runtimeRules: { cache: '#nitro/runtime/route-rule-handlers' }, baseURL, preMerge: true }
    const plugin = routeRulesCaseFoldPlugin(() => ({ options: { routeRules, baseURL } }) as Nitro)
    const code = await plugin.transform.handler(compileRouteRules(routeRules, options).toString(), '#nitro/virtual/routing')
    const file = join(await mkdtemp(join(tmpdir(), 'nuxt-route-rules-')), 'routing.mjs')
    await writeFile(file, code!.replace(/from "(h3[^"]*)"/g, (_, id) => `from ${JSON.stringify(pathToFileURL(resolveModulePath(id, { from: nitroPackage })).href)}`))
    const { findRouteRules } = await import(pathToFileURL(file).href)
    const match = createMatcherFromFind(findRouteRules)
    return (path: string, method = 'GET') => match(method, path).routeRules as Record<string, any>
  }

  it('matches rules regardless of the casing of the path or the pattern', async () => {
    const match = await loadMatcher({
      '/admin/**': { headers: { 'x-admin': '1' } },
      '/Docs': { headers: { 'x-docs': '1' } },
      '/école': { headers: { 'x-ecole': '1' } },
      '/n/:id(\\D+)': { headers: { 'x-n': '1' } },
      'POST /Form': { headers: { 'x-form': '1' } },
    })

    for (const path of ['/admin/a', '/Admin/a', '/ADMIN/a', '/%41dmin/a', '/%61dmin/a']) {
      expect(match(path).headers, path).toEqual({ 'x-admin': '1' })
    }
    for (const path of ['/Docs', '/docs', '/DOCS', '/%64ocs']) {
      expect(match(path).headers, path).toEqual({ 'x-docs': '1' })
    }
    for (const path of ['/%C3%A9cole', '/%C3%89cole', '/%c3%89COLE']) {
      expect(match(path).headers, path).toEqual({ 'x-ecole': '1' })
    }
    expect(match('/N/abc').headers).toEqual({ 'x-n': '1' })
    expect(match('/N/123').headers).toBeUndefined()
    expect(match('/form', 'POST').headers).toEqual({ 'x-form': '1' })
    expect(match('/form').headers).toBeUndefined()
  })

  it('keeps the base of a rule matched in its own casing', async () => {
    const routeRules = { '/Old/**': { redirect: '/new/**' }, '/**': { headers: { 'x-all': '1' } } }
    const match = await loadMatcher(routeRules)

    expect(match('/Old/page')).toEqual({ headers: { 'x-all': '1' }, redirect: { to: '/new/**', status: 307, base: '/Old' } })
    expect(match('/old/page').redirect).toMatchObject({ to: '/new/**' })
  })

  it('merges the options of rules whose keys fold together', async () => {
    const match = await loadMatcher({
      '/Admin': { headers: { 'x-a': '1', 'x-c': '1' } },
      '/admin': { headers: { 'x-b': '1', 'x-c': '2' } },
    })

    expect(match('/ADMIN').headers).toEqual({ 'x-a': '1', 'x-b': '1', 'x-c': '2' })
  })

  it('matches constraints regardless of casing', async () => {
    const match = await loadMatcher({
      '/x/:id((?:foo|bar))': { headers: { 'x-id': '1' } },
      '/Y/:id([A-z]+)': { headers: { 'x-id': '2' } },
    })

    for (const path of ['/x/FOO', '/x/foo', '/X/Bar']) {
      expect(match(path).headers, path).toEqual({ 'x-id': '1' })
    }
    for (const path of ['/y/AAA', '/y/a_A', '/Y/_']) {
      expect(match(path).headers, path).toEqual({ 'x-id': '2' })
    }
    expect(match('/y/123').headers).toBeUndefined()
  })

  it('rejects constraints that depend on letter case', async () => {
    await expect(loadMatcher({ '/x/:id((?:FOO|bar))': { headers: { 'x-id': '1' } } })).rejects.toThrow('NUXT_B4022 /x/:id((?:FOO|bar)) F')
  })

  it('matches rules under a base URL regardless of casing', async () => {
    const match = await loadMatcher({ '/admin': { headers: { 'x-admin': '1' } } }, '/App/')

    expect(match('/App/admin').headers).toEqual({ 'x-admin': '1' })
    expect(match('/app/Admin').headers).toEqual({ 'x-admin': '1' })
  })

  it('leaves other modules alone', async () => {
    const plugin = routeRulesCaseFoldPlugin(() => { throw new Error('unreachable') })
    expect(await plugin.transform.handler('export const findRouteRules = 1', '#nitro/virtual/app')).toBeUndefined()
  })

  it('fails the build when the lookup cannot be found', async () => {
    const plugin = routeRulesCaseFoldPlugin(() => ({ options: { routeRules: {} } }) as unknown as Nitro)
    await expect(plugin.transform.handler('export function findRouteRules () {}', '#nitro/virtual/routing')).rejects.toThrow('findRouteRules')
  })
})
