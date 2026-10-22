import { describe, expect, it, vi } from 'vitest'
import { defu } from 'defu'
import type { Nuxt } from '@nuxt/schema'

import { addRouteRulesTemplate } from '../src/route-rules'

const { templates } = vi.hoisted(() => ({ templates: [] as Array<{ getContents: (ctx: { nuxt: Nuxt }) => string }> }))

vi.mock('@nuxt/kit', async importOriginal => ({
  ...await importOriginal<typeof import('@nuxt/kit')>(),
  tryUseNitro: () => undefined,
  addTemplate: (template: { getContents: (ctx: { nuxt: Nuxt }) => string }) => {
    templates.push(template)
    return { dst: 'route-rules.mjs' }
  },
}))

function compileMatcher (routeRules: Record<string, Record<string, unknown>>) {
  templates.length = 0
  addRouteRulesTemplate()
  const nuxt = { options: { routeRules, app: { baseURL: '/' }, router: { options: {} } } } as unknown as Nuxt
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
