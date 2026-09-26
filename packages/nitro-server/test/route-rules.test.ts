import { describe, expect, it, vi } from 'vitest'
import type { NitroConfig } from 'nitro/types'
import { normalizeLegacyRouteRules } from '../src/route-rules.ts'

vi.mock('@nuxt/kit/internal', () => ({
  bundlerDiagnostics: { NUXT_B7026: vi.fn() },
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
