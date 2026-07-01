import type { NuxtPage } from '@nuxt/schema'
import { describe, expect, it } from 'vitest'

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

  it('extracts route rules from pages', () => {
    const pages = getPages()
    const result = globRouteRulesFromPages(pages)
    expect(result).toEqual({
      '/': { prerender: true },
      '/some/nested/page': { prerender: true },
      '/users/**': { prerender: true },
    })
  })

  it('does not collapse constrained params to a global rule', () => {
    const pages = [
      {
        path: '/:locale(de)/account/verify',
        rules: { robots: false },
      },
      {
        path: '/:locale(de|fr)/privacy-policy',
        rules: { robots: false },
      },
      {
        path: '/:locale(de|fr)/blog/:slug',
        rules: { swr: 60 },
      },
    ]

    expect(globRouteRulesFromPages(pages)).toEqual({
      '/de/account/verify': { robots: false },
      '/de/blog/**': { swr: 60 },
      '/de/privacy-policy': { robots: false },
      '/fr/blog/**': { swr: 60 },
      '/fr/privacy-policy': { robots: false },
    })
  })

  it('warns when a route rule glob is broader than the page route', () => {
    const warnings: string[] = []
    const pages = [
      {
        path: '/foo-:id',
        rules: { swr: 60 },
      },
      {
        path: '/users/:id(\\d+)',
        rules: { prerender: true },
      },
    ]

    expect(globRouteRulesFromPages(pages, {}, '', { warn: message => warnings.push(message) })).toEqual({
      '/**': { swr: 60 },
      '/users/**': { prerender: true },
    })
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toContain('partial dynamic segment')
    expect(warnings[1]).toContain('custom RegExp constraint')
  })

  it('does not generate broad route rules for multiple unresolved dynamic params', () => {
    const warnings: string[] = []
    const pages = [
      {
        path: '/foo/:id/:slug',
        rules: { swr: 60 },
      },
    ]

    expect(globRouteRulesFromPages(pages, {}, '', { warn: message => warnings.push(message) })).toEqual({})
    expect(warnings).toEqual([
      'Inline route rules for `/foo/:id/:slug` could not be mapped and were skipped because multiple dynamic params cannot be represented by a single Nitro route rule glob.',
    ])
  })

  it('warns when generated route rule globs conflict', () => {
    const warnings: string[] = []
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

    expect(globRouteRulesFromPages(pages, {}, '', { warn: message => warnings.push(message) })).toEqual({
      '/foo/**': { prerender: true },
    })
    expect(warnings).toEqual([
      'Inline route rules for `/foo/:slug` generated `/foo/**`, which is already used by another page. The later inline route rules will override the earlier ones.',
    ])
  })

  it('expands constrained params from parent route records', () => {
    const pages: NuxtPage[] = [
      {
        path: '/:locale(en-US|pt_BR)',
        children: [
          {
            path: 'account',
            children: [
              {
                path: 'verify',
                rules: { prerender: true },
              },
            ],
          },
          {
            path: 'blog/:slug',
            rules: { swr: 60 },
          },
        ],
      },
    ]

    expect(globRouteRulesFromPages(pages)).toEqual({
      '/en-US/account/verify': { prerender: true },
      '/en-US/blog/**': { swr: 60 },
      '/pt_BR/account/verify': { prerender: true },
      '/pt_BR/blog/**': { swr: 60 },
    })
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
