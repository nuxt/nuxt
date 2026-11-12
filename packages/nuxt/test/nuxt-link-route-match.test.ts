import { describe, expect, it } from 'vitest'
import type { RouteLocationGeneric, RouteRecordNormalized } from 'vue-router'

import { isPlainAbsolutePath, mayMatchCurrentRoute } from '../src/app/components/route-match'

function currentRoute (...paths: string[]): RouteLocationGeneric {
  return { matched: paths.map(path => ({ path })) } as unknown as RouteLocationGeneric
}

describe('isPlainAbsolutePath', () => {
  it.each([
    ['/', true],
    ['/a/b', true],
    ['/a/b/', true],
    ['a/b', false],
    ['/a?x=1', false],
    ['/a#top', false],
    ['/a%20b', false],
  ])('%s -> %s', (path, expected) => {
    expect(isPlainAbsolutePath(path)).toBe(expected)
  })
})

describe('mayMatchCurrentRoute', () => {
  it('matches the root record', () => {
    expect(mayMatchCurrentRoute(currentRoute('/'), '/')).toBe(true)
    expect(mayMatchCurrentRoute(currentRoute('/'), '/a')).toBe(false)
  })

  it('matches static segments regardless of case and trailing slash', () => {
    const route = currentRoute('/about')
    expect(mayMatchCurrentRoute(route, '/about')).toBe(true)
    expect(mayMatchCurrentRoute(route, '/About/')).toBe(true)
    expect(mayMatchCurrentRoute(route, '/about/team')).toBe(false)
    expect(mayMatchCurrentRoute(route, '/contact')).toBe(false)
  })

  it('matches param segments against any non-empty segment', () => {
    const route = currentRoute('/users', '/users/:id()')
    expect(mayMatchCurrentRoute(route, '/users/42')).toBe(true)
    expect(mayMatchCurrentRoute(route, '/users')).toBe(true)
    expect(mayMatchCurrentRoute(route, '/users//')).toBe(false)
    expect(mayMatchCurrentRoute(route, '/posts/42')).toBe(false)
  })

  it.each([
    '/docs/:slug()?',
    '/docs/:slug(.*)*',
    '/docs/:slug(\\d+)',
    '/docs/:a()-:b()',
  ])('stays conservative for %s', (path) => {
    expect(mayMatchCurrentRoute(currentRoute(path), '/elsewhere')).toBe(true)
  })

  it('stays conservative for alias records', () => {
    const route = { matched: [{ path: '/a', aliasOf: { path: '/b' } } as unknown as RouteRecordNormalized] } as unknown as RouteLocationGeneric
    expect(mayMatchCurrentRoute(route, '/elsewhere')).toBe(true)
  })
})
