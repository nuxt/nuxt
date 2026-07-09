import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'
import { createLazyRouteResolver } from '../src/pages/runtime/lazy-routes-resolver'

// Mirrors the shape produced by `normalizeRoutesForLazyDiscovery`: data-only top-level stubs, each
// carrying its group marker in `meta.__nuxtRouteGroup`. Names are the synthetic ones the generator
// assigns to unnamed pages.
function stub (path: string, name: string, group: [number, number], extra: Partial<RouteRecordRaw> = {}): RouteRecordRaw {
  return { path, name, meta: { __nuxtRouteGroup: group }, ...extra } as RouteRecordRaw
}

const STUBS: RouteRecordRaw[] = [
  stub('/', 'index', [0, 0]),
  stub('/about', 'about', [0, 1]),
  stub('/users/:id', 'users-id', [1, 0]),
  stub('/blog/:slug', 'blog-slug', [1, 1]),
  stub('/parent', 'parent', [2, 0], {
    children: [{ path: 'child', name: 'parent-child' } as RouteRecordRaw],
  }),
  stub('/old', 'old', [2, 1], { redirect: '/about' }),
  stub('/:catchall(.*)*', 'catchall', [3, 0]),
]

describe('lazy route resolver (server endpoint core)', () => {
  const resolver = createLazyRouteResolver(STUBS)

  it('resolves a static path to its top-level stub, marker intact', () => {
    const rec = resolver.resolve('/about')
    expect(rec?.name).toBe('about')
    expect((rec?.meta as any).__nuxtRouteGroup).toEqual([0, 1])
  })

  it('resolves a dynamic path to its PATTERN stub (not the literal)', () => {
    const rec = resolver.resolve('/users/2')
    expect(rec?.name).toBe('users-id')
    expect(rec?.path).toBe('/users/:id')
  })

  it('returns the whole top-level subtree for a nested child match', () => {
    const rec = resolver.resolve('/parent/child')
    expect(rec?.name).toBe('parent')
    expect((rec?.children as RouteRecordRaw[])?.[0]?.name).toBe('parent-child')
  })

  it('resolves a redirect stub for the redirecting path', () => {
    const rec = resolver.resolve('/old')
    expect(rec?.name).toBe('old')
    expect(rec?.redirect).toBe('/about')
  })

  it('a more-specific path wins over the catch-all', () => {
    expect(resolver.resolve('/blog/hello')?.name).toBe('blog-slug')
  })

  it('falls back to the catch-all only when nothing specific matches', () => {
    expect(resolver.resolve('/totally/unknown/xyz')?.name).toBe('catchall')
  })

  it('returns the same serializable object it was given (no dummy component leaks)', () => {
    const rec = resolver.resolve('/about')
    expect(rec).toBe(STUBS[1])
    expect((rec as any).component).toBeUndefined()
  })

  describe('resolveMany', () => {
    it('dedupes by name and reports notFound', () => {
      const res = resolver.resolveMany(['/about', '/users/2', '/users/9', '/about'])
      expect(res.records.map(r => r.name)).toEqual(['about', 'users-id'])
      expect(res.notFound).toEqual([])
    })

    it('never lists notFound when a catch-all is present (everything matches)', () => {
      const res = resolver.resolveMany(['/nope'])
      expect(res.records.map(r => r.name)).toEqual(['catchall'])
      expect(res.notFound).toEqual([])
    })
  })

  describe('without a catch-all in the table', () => {
    const bare = createLazyRouteResolver(STUBS.filter(s => s.name !== 'catchall'))
    it('reports genuinely-unmatched paths as notFound', () => {
      expect(bare.resolve('/nope')).toBeUndefined()
      const res = bare.resolveMany(['/about', '/nope'])
      expect(res.records.map(r => r.name)).toEqual(['about'])
      expect(res.notFound).toEqual(['/nope'])
    })
  })

  describe('resolveName / resolveQuery', () => {
    it('resolves a top-level stub by name', () => {
      expect(resolver.resolveName('blog-slug')?.path).toBe('/blog/:slug')
      expect(resolver.resolveName('nope')).toBeUndefined()
    })

    it('resolveQuery mixes paths and names, deduped, with notFound', () => {
      const res = resolver.resolveQuery({ paths: ['/about'], names: ['users-id', 'about', 'ghost'] })
      // '/about' and name 'about' are the same record → deduped
      expect(res.records.map(r => r.name).sort()).toEqual(['about', 'users-id'])
      expect(res.notFound).toEqual(['ghost'])
    })
  })

  it('all() returns the full stub table (static fallback)', () => {
    expect(resolver.all()).toBe(STUBS)
    expect(resolver.all()).toHaveLength(7)
  })
})
