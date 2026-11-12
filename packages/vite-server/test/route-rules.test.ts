import { describe, expect, it, vi } from 'vitest'
import { defu } from 'defu'
import type { Nuxt } from '@nuxt/schema'

import { addRouteRulesTemplate } from '../src/route-rules'
import { createFetchHandler } from '../src/runtime/renderer.ts'

const { templates } = vi.hoisted(() => ({ templates: [] as Array<{ getContents: (ctx: { nuxt: Nuxt }) => string }> }))

vi.mock('@nuxt/kit', async importOriginal => ({
  ...await importOriginal<typeof import('@nuxt/kit')>(),
  tryUseNitro: () => undefined,
  addTemplate: (template: { getContents: (ctx: { nuxt: Nuxt }) => string }) => {
    templates.push(template)
    return { dst: 'route-rules.mjs' }
  },
}))

function compileMatcher (routeRules: Record<string, Record<string, unknown>>, { baseURL = '/', sensitive = true } = {}) {
  templates.length = 0
  addRouteRulesTemplate()
  const nuxt = { options: { routeRules, app: { baseURL }, router: { options: { sensitive } } } } as unknown as Nuxt
  const code = templates[0]!.getContents({ nuxt })
    .replace(/^import \{ defu \} from .*$/m, '')
    .replace('export default', 'return')
  return new Function('defu', code)(defu) as (path: string, method?: string) => Record<string, any>
}

describe('vite server route rules matcher', () => {
  it('resolves method-scoped rules for the request method', () => {
    const match = compileMatcher({
      '/api/**': { headers: { 'x-all': '1', 'x-scope': 'all' } },
      'GET /api/**': { headers: { 'x-scope': 'get' } },
      'POST /api/**': { headers: { 'x-scope': 'post' } },
      'HEAD /api/head': { headers: { 'x-head': '1' } },
      'GET /old': { redirect: '/new' },
    })

    expect(match('/api/users').headers).toEqual({ 'x-all': '1', 'x-scope': 'get' })
    expect(match('/api/users', 'GET').headers).toEqual({ 'x-all': '1', 'x-scope': 'get' })
    expect(match('/api/users', 'post').headers).toEqual({ 'x-all': '1', 'x-scope': 'post' })
    expect(match('/api/users', 'PUT').headers).toEqual({ 'x-all': '1', 'x-scope': 'all' })
    expect(match('/api/users', 'HEAD').headers).toEqual({ 'x-all': '1', 'x-scope': 'get' })
    expect(match('/api/head', 'HEAD').headers).toEqual({ 'x-all': '1', 'x-scope': 'get', 'x-head': '1' })
    expect(match('/api/head', 'GET').headers).toEqual({ 'x-all': '1', 'x-scope': 'get' })

    expect(match('/old', 'GET').redirect).toMatchObject({ to: '/new' })
    expect(match('/old', 'HEAD').redirect).toMatchObject({ to: '/new' })
    expect(match('/old', 'POST')).not.toHaveProperty('redirect')
  })
})

describe('vite server wildcard redirects', () => {
  const renderer = { fetch: () => Promise.resolve(new Response('rendered')) }

  async function redirectFor (path: string, routeRules: Record<string, Record<string, unknown>>, options?: { baseURL?: string, sensitive?: boolean }) {
    const response = await createFetchHandler(renderer, compileMatcher(routeRules, options))(new Request(`http://localhost${path}`))
    return response.headers.get('location')
  }

  it('moves the tail of the request onto the target', async () => {
    const rules = { '/old/**': { redirect: '/new/**' } }
    expect(await redirectFor('/old/A/b?q=Value', rules)).toBe('/new/A/b?q=Value')
    expect(await redirectFor('/old', rules)).toBe('/new')
    expect(await redirectFor('/%6Fld/A/b', rules)).toBe('/new/A/b')
    expect(await redirectFor('/caf%C3%A9/A/b', { '/café/**': { redirect: '/new/**' } })).toBe('/new/A/b')
    expect(await redirectFor('/old/Some-ID/A/b', { '/old/:id/**': { redirect: '/new/**' } })).toBe('/new/A/b')
    expect(await redirectFor('/old/A/b', { '/old/**': { redirect: '/new?path=**' } })).toBe('/new?path=A/b')
  })

  it('moves the tail of the request onto the target under a base URL', async () => {
    const rules = { '/old/**': { redirect: '/new/**' } }
    expect(await redirectFor('/app/old/A/b?q=Value', rules, { baseURL: '/app/' })).toBe('/new/A/b?q=Value')
    expect(await redirectFor('/app/A/b', { '/**': { redirect: '/new/**' } }, { baseURL: '/app/' })).toBe('/new/A/b')
  })

  it('keeps the casing of the tail when the base matches in another casing', async () => {
    const rules = { '/Old/**': { redirect: '/new/**' } }
    for (const path of ['/old/A/b?q=Value', '/OLD/A/b?q=Value', '/Old/A/b?q=Value']) {
      expect(await redirectFor(path, rules, { sensitive: false }), path).toBe('/new/A/b?q=Value')
    }
    expect(await redirectFor('/APP/OLD/A/b', rules, { sensitive: false, baseURL: '/App/' })).toBe('/new/A/b')
  })

  it('keeps the target on its origin when the tail starts with separators', async () => {
    const rules = { '/old/**': { redirect: '/**' } }
    for (const tail of ['//evil.com', '///evil.com', '/%2F%2Fevil.com', '/%5C%5Cevil.com', '/%252F%252Fevil.com']) {
      expect(await redirectFor(`/old${tail}`, rules), tail).toBe('/evil.com')
    }
    expect(await redirectFor('/OLD//evil.com', rules, { sensitive: false })).toBe('/evil.com')
    expect(await redirectFor('/app/old//evil.com', rules, { baseURL: '/app/' })).toBe('/evil.com')
    expect(await redirectFor('/old//evil.com', { '/old/**': { redirect: '**' } })).toBe('evil.com')
  })

  it('encodes a tail in the query of the target', async () => {
    expect(await redirectFor('/old/a&admin=1', { '/old/**': { redirect: '/new?to=**' } })).toBe('/new?to=a%26admin%3D1')
    expect(await redirectFor('/old/a', { '/old/**': { redirect: '/new#**' } })).toBe('/new#a')
    expect(await redirectFor('/old/$&', { '/old/**': { redirect: '/new/**/x' } })).toBe('/new/$&/x')
  })

  it('does not redirect another casing with `sensitive` routing', async () => {
    expect(await redirectFor('/OLD/A/b', { '/old/**': { redirect: '/new/**' } })).toBeNull()
  })
})
