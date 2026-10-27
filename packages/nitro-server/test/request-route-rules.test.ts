import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'

import { matchAllRouteRules } from '../../nuxt/src/core/utils/index.ts'
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
  matchAllRouteRules,
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

  it('resolves rules for a request path with encoded slashes', async () => {
    const { resolveRequestRouteRules } = await load({
      routeRules: {
        '/**': { headers: { 'x-a': 'all' } },
        '/admin/**': { redirect: { to: '/login', statusCode: 307 } },
        '/content/admin/secret': { headers: { 'x-a': 'secret' } },
        '/users/*': { headers: { 'x-a': 'user' } },
      },
    })
    for (const path of ['/admin%2Fx', '/admin%2fx', '/Admin%2Fx/y', '/x/..%2Fadmin%2Fy']) {
      expect(resolveRequestRouteRules(event(path)), path).toEqual({ headers: { 'x-a': 'all' }, redirect: { to: '/login', statusCode: 307 } })
    }
    expect(resolveRequestRouteRules(event('/content/admin%2Fsecret?x=%2F'))).toEqual({ headers: { 'x-a': 'secret' } })
    expect(resolveRequestRouteRules(event('/users/a%2Fb'))).toEqual({ headers: { 'x-a': 'user' } })
    expect(resolveRequestRouteRules(event('/admin%252Fx'))).toEqual({ headers: { 'x-a': 'all' } })
  })

  it('takes the strip base of wildcard redirect and proxy rules from the request path', async () => {
    const routeRules = {
      '/old/**': { redirect: { to: '/new/**', statusCode: 307, _redirectStripBase: '/old' } },
      '/api/**': { proxy: { to: 'https://example.com/**', _proxyStripBase: '/api' } },
      '/**': { redirect: { to: '/fallback/**', statusCode: 307, _redirectStripBase: '' } },
    }
    const { resolveRequestRouteRules } = await load({ routeRules })
    expect(resolveRequestRouteRules(event('/OLD/A/b?x=1')).redirect).toEqual({ to: '/new/**', statusCode: 307, _redirectStripBase: '/OLD' })
    expect(resolveRequestRouteRules(event('/Api/Users')).proxy).toEqual({ to: 'https://example.com/**', _proxyStripBase: '/Api' })
    expect(resolveRequestRouteRules(event('/old/a')).redirect).toEqual({ to: '/new/**', statusCode: 307, _redirectStripBase: '/old' })
    expect(resolveRequestRouteRules(event('/x/../OLD/a')).redirect).toEqual({ to: '/new/**', statusCode: 307, _redirectStripBase: '/old' })
    expect(resolveRequestRouteRules(event('/Other')).redirect).toEqual({ to: '/fallback/**', statusCode: 307, _redirectStripBase: '' })
    expect(routeRules['/old/**'].redirect._redirectStripBase).toBe('/old')

    vi.resetModules()
    const sensitive = await load({ fold: false, routeRules })
    expect(sensitive.resolveRequestRouteRules(event('/OLD/a')).redirect).toEqual({ to: '/fallback/**', statusCode: 307, _redirectStripBase: '' })
  })

  it('takes the strip base of wildcard rules under a base URL from the request path', async () => {
    const { resolveRequestRouteRules } = await load({
      baseURL: '/base/',
      routeRules: {
        '/old/**': { redirect: { to: '/new/**', statusCode: 307, _redirectStripBase: '/old' } },
        '/**': { proxy: { to: 'https://example.com/**', _proxyStripBase: '' } },
      },
    })
    expect(resolveRequestRouteRules(event('/base/OLD/a'))).toEqual({
      redirect: { to: '/new/**', statusCode: 307, _redirectStripBase: '/base/OLD' },
      proxy: { to: 'https://example.com/**', _proxyStripBase: '/base' },
    })
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
