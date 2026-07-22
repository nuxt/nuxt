import { pageDiagnostics } from '@nuxt/kit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { globRouteRulesFromPages, removePagesRules } from '../src/pages/route-rules.ts'

describe('routeRules from page meta', () => {
  const getPages = () => [
    {
      path: '/',
      rules: { prerender: true },
    },
    // parent without routeRules
    {
      path: '/users',
      children: [{ path: ':id', rules: { prerender: true } }],
    },
    // nested paths
    {
      path: '/some',
      children: [
        {
          path: 'nested',
          children: [{ path: 'page', rules: { prerender: true } }],
        },
      ],
    },
    // page with empty routeRules
    {
      path: '/contact',
      rules: {},
    },
  ]

  let collapse: ReturnType<typeof vi.spyOn>
  let collision: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    collapse = vi.spyOn(pageDiagnostics, 'NUXT_B4016').mockReturnValue(undefined as never)
    collision = vi.spyOn(pageDiagnostics, 'NUXT_B4017').mockReturnValue(undefined as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('extracts route rules from pages', () => {
    const pages = getPages()
    const result = globRouteRulesFromPages(pages)
    expect(result).toEqual({
      '/': { prerender: true },
      '/some/nested/page': { prerender: true },
      '/users/**': { prerender: true },
    })
  })

  it('expands finite alternation params into a rule per branch without warning', () => {
    const pages = [
      {
        path: '/:locale(de|fr)/account/verify',
        rules: { prerender: true },
      },
    ]

    expect(globRouteRulesFromPages(pages)).toEqual({
      '/de/account/verify': { prerender: true },
      '/fr/account/verify': { prerender: true },
    })
    expect(collapse).not.toHaveBeenCalled()
  })

  it('warns when a dynamic param collapses to a broader catch-all', () => {
    const pages = [
      {
        path: '/account/:id(\\d+)',
        rules: { prerender: true },
      },
    ]

    expect(globRouteRulesFromPages(pages)).toEqual({
      '/account/**': { prerender: true },
    })
    expect(collapse).toHaveBeenCalledWith({
      path: '/account/:id(\\d+)',
      detail: 'Collapsed "/account/:id(\\d+)" at segment ":id(\\d+)" into a `**` catch-all, which also matches nested paths',
    })
  })

  it('warns when inline route rules override the same route rule glob', () => {
    const pages = [
      {
        path: '/foo/:id',
        rules: { swr: 60 },
      },
      {
        path: '/foo/:slug',
        rules: { prerender: true },
      },
    ]

    expect(globRouteRulesFromPages(pages)).toEqual({
      '/foo/**': { prerender: true },
    })
    expect(collision).toHaveBeenCalledWith({ path: '/foo/:slug', pattern: '/foo/**' })
  })

  it('removes route rules from pages', () => {
    const pages = getPages()
    removePagesRules(pages)
    expect(pages).toEqual([
      { path: '/' },
      { path: '/users', children: [{ path: ':id' }] },
      {
        path: '/some',
        children: [{ path: 'nested', children: [{ path: 'page' }] }],
      },
      { path: '/contact' },
    ])
  })
})
