import { describe, expect, it } from 'vitest'

import { globRouteRulesFromPages, removePagesRules } from '../src/pages/route-rules'

describe('routeRules from page meta', () => {
  const pages = [
    {
      path: '/',
      rules: { prerender: true },
    },
    // parent without routeRules
    {
      path: '/users',
      children: [{ path: ':id', rules: { prerender: true } }],
    },
    // page with empty routeRules
    {
      path: '/contact',
      rules: {},
    },
  ]

  it('extracts route rules from pages', () => {
    const result = globRouteRulesFromPages(pages)
    expect(result).toEqual({
      '/': { prerender: true },
      '/users/**': { prerender: true },
    })
  })

  it('removes route rules from pages', () => {
    removePagesRules(pages)
    expect(pages).toEqual([
      { path: '/' },
      { path: '/users', children: [{ path: ':id' }] },
      { path: '/contact' },
    ])
  })
})
