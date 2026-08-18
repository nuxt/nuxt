import { describe, expect, it } from 'vitest'
import { unifyDynamicRouteRuleSegments } from './route-rules.ts'

function unify (routeRules: Record<string, Record<string, any>>) {
  unifyDynamicRouteRuleSegments(routeRules)
  return routeRules
}

describe('unifyDynamicRouteRuleSegments', () => {
  it('gives sibling dynamic segments a single name', () => {
    expect(unify({
      '/:slug/about': { swr: 60 },
      '/:locale/:slug/about': { swr: 60 },
    })).toStrictEqual({
      '/:slug/about': { swr: 60 },
      '/:slug/:slug_/about': { swr: 60 },
    })
  })

  it('leaves keys untouched when no siblings clash', () => {
    const routeRules = {
      '/:slug/about': { swr: 60 },
      '/docs/:slug': { swr: 60 },
      '/docs/:slug/edit': { swr: 60 },
      '/**': { ssr: false },
    }
    expect(unify({ ...routeRules })).toStrictEqual(routeRules)
  })

  it('unifies unnamed segments and nested siblings', () => {
    expect(unify({
      '/*/about': { swr: 60 },
      '/:locale/about': { swr: 60 },
      '/team/:id/edit': { swr: 60 },
      '/team/:slug/view': { swr: 60 },
    })).toStrictEqual({
      '/:_1/about': { swr: 60 },
      '/team/:id/edit': { swr: 60 },
      '/team/:id/view': { swr: 60 },
    })
  })

  it('leaves segments with a pattern or modifier alone', () => {
    const routeRules = {
      '/:id(\\d+)/about': { swr: 60 },
      '/:slug?/about': { swr: 60 },
      '/:locale/about': { isr: true },
    }
    expect(unify({ ...routeRules })).toStrictEqual(routeRules)
  })

  it('skips a rename that would duplicate a constrained or optional placeholder name', () => {
    const routeRules = {
      '/:a/x': { swr: 60 },
      '/:b/:a(\\d+)/y': { swr: 60 },
      '/:c/:a?/z': { swr: 60 },
    }
    expect(unify({ ...routeRules })).toStrictEqual(routeRules)
  })

  it('follows renames into redirect and proxy targets', () => {
    expect(unify({
      '/:slug/about': { swr: 60 },
      '/:locale/moved': { redirect: { to: '/new/:locale', statusCode: 301 } },
      '/:tenant/api': { proxy: { to: 'https://example.com/:tenant' } },
    })).toStrictEqual({
      '/:slug/about': { swr: 60 },
      '/:slug/moved': { redirect: { to: '/new/:slug', statusCode: 301 } },
      '/:slug/api': { proxy: { to: 'https://example.com/:slug' } },
    })
  })
})
