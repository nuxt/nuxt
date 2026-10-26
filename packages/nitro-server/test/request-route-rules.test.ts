import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'

import { normalizeRouteRulePath } from '../../nuxt/src/core/utils/route-rules.ts'

const state = vi.hoisted(() => ({
  fold: true,
  baseURL: '/',
  routeRules: {} as Record<string, Record<string, any>>,
}))

vi.mock('nitropack/runtime', () => ({
  useRuntimeConfig: () => ({ app: { baseURL: state.baseURL }, nitro: { routeRules: state.routeRules } }),
}))
vi.mock('#internal/nuxt/route-rules.mjs', () => ({
  normalizeRouteRulePath: (path: string) => normalizeRouteRulePath(path, state.fold),
}))

function load (options: Partial<typeof state>) {
  Object.assign(state, { fold: true, baseURL: '/', routeRules: {} }, options)
  return import('../src/runtime/utils/route-rules.ts')
}

function event (path: string, context: Record<string, any> = {}) {
  return { path, context } as unknown as H3Event
}

describe('request route rules', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('matches rule keys and paths case-insensitively unless routing is sensitive', async () => {
    const routeRules = {
      '/admin/**': { redirect: { to: '/login', statusCode: 307 } },
      '/Docs': { headers: { 'x-docs': '1' } },
    }

    const folded = await load({ routeRules })
    expect(folded.matchRouteRules('/ADMIN/secret')).toEqual({ redirect: { to: '/login', statusCode: 307 } })
    expect(folded.matchRouteRules('/docs')).toEqual({ headers: { 'x-docs': '1' } })
    expect(folded.matchRouteRules('/%44ocs')).toEqual({ headers: { 'x-docs': '1' } })

    vi.resetModules()
    const sensitive = await load({ fold: false, routeRules })
    expect(sensitive.matchRouteRules('/ADMIN/secret')).toEqual({})
    expect(sensitive.matchRouteRules('/admin/secret')).toEqual({ redirect: { to: '/login', statusCode: 307 } })
    expect(sensitive.matchRouteRules('/Docs')).toEqual({ headers: { 'x-docs': '1' } })
  })

  it('merges matching rules with the most specific taking precedence', async () => {
    const { matchRouteRules } = await load({
      routeRules: {
        '/**': { headers: { 'x-a': 'all' } },
        '/blog/**': { headers: { 'x-a': 'blog', 'x-b': 'blog' } },
        '/blog/post': { ssr: false },
      },
    })
    expect(matchRouteRules('/Blog/Post')).toEqual({ ssr: false, headers: { 'x-a': 'blog', 'x-b': 'blog' } })
  })

  it('resolves rules for a request without the base URL or query', async () => {
    const { resolveRequestRouteRules } = await load({
      baseURL: '/base/',
      routeRules: { '/admin': { ssr: false } },
    })
    expect(resolveRequestRouteRules(event('/base/Admin?x=1'))).toEqual({ ssr: false })
  })

  it('resolves rules for a request path with dot segments', async () => {
    const { resolveRequestRouteRules } = await load({
      routeRules: {
        '/dashboard': { headers: { 'x-frame-options': 'DENY' } },
        '/old': { redirect: { to: '/new', statusCode: 307 } },
      },
    })
    for (const path of ['/./dashboard', '/x/../dashboard', '/dashboard/.', '/%2e/dashboard', '/x/%2E%2e/dashboard']) {
      expect(resolveRequestRouteRules(event(path))).toEqual({ headers: { 'x-frame-options': 'DENY' } })
    }
    for (const path of ['/./old', '/old/.', '/%2e%2e/old', '/a/b/../../old?x=1']) {
      expect(resolveRequestRouteRules(event(path))).toEqual({ redirect: { to: '/new', statusCode: 307 } })
    }
  })

  it('reuses rules already resolved for a request', async () => {
    const { getRouteRules } = await load({ routeRules: { '/admin': { ssr: false } } })
    const resolved = { noScripts: true }
    expect(getRouteRules(event('/admin', { _nitro: { routeRules: resolved } }))).toBe(resolved)

    const fresh = event('/Admin')
    expect(getRouteRules(fresh)).toEqual({ ssr: false })
    expect(fresh.context._nitro.routeRules).toEqual({ ssr: false })
  })
})
