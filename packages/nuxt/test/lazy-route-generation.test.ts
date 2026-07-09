import { describe, expect, it, vi } from 'vitest'
import type { NuxtPage } from 'nuxt/schema'
import { normalizeRoutesForLazyDiscovery } from '../src/pages/utils.ts'
import { LAZY_ROUTE_GROUP_KEY } from '../src/pages/runtime/lazy-routes.ts'

vi.mock('@nuxt/kit', async (original) => {
  const mod = await original<typeof import('@nuxt/kit')>()
  return {
    ...mod,
    useNuxt: vi.fn(() => {
      return {
        options: {
          experimental: {
            normalizePageNames: false,
          },
        },
      }
    }),
  }
})

const DYNAMIC_META_KEY = '__nuxt_dynamic_meta_key'

const options = {
  clientComponentRuntime: '<client-component-runtime>',
  serverComponentRuntime: '<server-component-runtime>',
  overrideMeta: true,
  groupSize: 10,
}

function marker (group: number, position: number) {
  return JSON.stringify({ [LAZY_ROUTE_GROUP_KEY]: [group, position] })
}

describe('pages:normalizeRoutesForLazyDiscovery', () => {
  it('splits static pages into stubs and lazy groups', () => {
    const pages: NuxtPage[] = [
      { name: 'index', path: '/', file: '/app/pages/index.vue', children: [] },
      { name: 'about', path: '/about', file: '/app/pages/about.vue', children: [] },
    ]

    const { routes, imports, groups } = normalizeRoutesForLazyDiscovery(pages, options)

    expect(groups).toHaveLength(1)
    expect(groups[0]!.routes).toHaveLength(2)

    // stubs carry only matching-relevant fields plus the group marker
    expect(routes).toContain(marker(0, 0))
    expect(routes).toContain(marker(0, 1))
    expect(routes).toContain('"index"')
    expect(routes).toContain('"/about"')
    expect(routes).not.toContain('import(')
    expect(routes).not.toContain('component')
    expect(imports.size).toBe(0)

    // groups contain the full records with component thunks and macro imports
    expect(groups[0]!.routes[0]).toContain('import("/app/pages/index.vue")')
    expect(groups[0]!.routes[1]).toContain('import("/app/pages/about.vue")')
    expect([...groups[0]!.imports].join('\n')).toContain('?macro=true')
  })

  it('separates data-only stubs (server endpoint) from eager routes', () => {
    const pages: NuxtPage[] = [
      // lazy-discoverable -> becomes a data-only stub, feeds the server resolve endpoint
      { name: 'about', path: '/about', file: '/app/pages/about.vue', children: [] },
      // dynamic matching field -> cannot be stubbed, stays eager (ships to client always)
      { name: 'a', path: '/a', file: '/app/pages/a.vue', children: [], meta: { [DYNAMIC_META_KEY]: new Set(['path']) } as any },
    ]

    const { stubRoutes, eagerRoutes, stubPages } = normalizeRoutesForLazyDiscovery(pages, options)

    // stubRoutes: pure data (no component thunks / imports), marker present
    expect(stubRoutes).toContain('"/about"')
    expect(stubRoutes).toContain(marker(0, 0))
    expect(stubRoutes).not.toContain('import(')
    expect(stubRoutes).not.toContain('component')

    // eagerRoutes: the un-stubbable route, WITH its component thunk
    expect(eagerRoutes).toContain('import("/app/pages/a.vue")')
    expect(eagerRoutes).not.toContain('"/about"')

    // stubPages tracks the pages that were foggable
    expect(stubPages.map(p => p.name)).toEqual(['about'])
  })

  it('batches records into groups of `groupSize`', () => {
    const pages: NuxtPage[] = Array.from({ length: 7 }, (_, i) => (
      { name: `page-${i}`, path: `/page-${i}`, file: `/app/pages/page-${i}.vue`, children: [] }
    ))

    const { routes, groups } = normalizeRoutesForLazyDiscovery(pages, { ...options, groupSize: 3 })

    expect(groups.map(g => g.routes.length)).toEqual([3, 3, 1])
    expect(routes).toContain(marker(0, 2))
    expect(routes).toContain(marker(1, 0))
    expect(routes).toContain(marker(2, 0))
  })

  it.each(['name', 'path', 'alias', 'redirect'] as const)('keeps pages with dynamic %s eager', (key) => {
    const pages: NuxtPage[] = [
      { name: 'a', path: '/a', file: '/app/pages/a.vue', children: [], meta: { [DYNAMIC_META_KEY]: new Set([key]) } as any },
      { name: 'b', path: '/b', file: '/app/pages/b.vue', children: [] },
    ]

    const { routes, imports, groups } = normalizeRoutesForLazyDiscovery(pages, options)

    expect(groups).toHaveLength(1)
    expect(groups[0]!.routes).toHaveLength(1)

    // the dynamic record stays inline with its imports
    expect(routes).toContain('import("/app/pages/a.vue")')
    expect([...imports].join('\n')).toContain('/app/pages/a.vue?macro=true')

    // the static record is still stubbed
    expect(routes).toContain(marker(0, 0))
    expect(routes).not.toContain('import("/app/pages/b.vue")')
  })

  it('keeps pages with dynamic render-only keys foggable', () => {
    const pages: NuxtPage[] = [
      { name: 'a', path: '/a', file: '/app/pages/a.vue', children: [], meta: { [DYNAMIC_META_KEY]: new Set(['meta', 'props']) } as any },
    ]

    const { routes, groups } = normalizeRoutesForLazyDiscovery(pages, options)

    expect(groups).toHaveLength(1)
    expect(routes).not.toContain('import(')
  })

  it('marks subtree eager when any child has dynamic matching fields', () => {
    const pages: NuxtPage[] = [
      {
        name: undefined,
        path: '/parent',
        file: '/app/pages/parent.vue',
        children: [
          { name: 'parent-child', path: 'child', file: '/app/pages/parent/child.vue', children: [], meta: { [DYNAMIC_META_KEY]: new Set(['path']) } as any },
        ],
      },
    ]

    const { routes, groups } = normalizeRoutesForLazyDiscovery(pages, options)

    expect(groups).toHaveLength(0)
    expect(routes).toContain('import("/app/pages/parent.vue")')
  })

  it('retains children, alias and redirect on stubs for matching fidelity', () => {
    const pages: NuxtPage[] = [
      {
        name: undefined,
        path: '/parent',
        file: '/app/pages/parent.vue',
        children: [
          { name: 'parent-child', path: 'child', file: '/app/pages/parent/child.vue', children: [], alias: ['aliased-child'] },
        ],
      },
      { name: 'moved', path: '/moved', file: '/app/pages/moved.vue', children: [], redirect: '/parent' },
    ]

    const { routes, groups } = normalizeRoutesForLazyDiscovery(pages, options)

    expect(groups).toHaveLength(1)
    expect(groups[0]!.routes).toHaveLength(2)

    expect(routes).toContain('"parent-child"')
    expect(routes).toContain('"child"')
    expect(routes).toContain('"aliased-child"')
    // unnamed top-level pages receive a synthetic name so swaps can replace by name
    expect(routes).toContain('"_lazy-group-0-0"')
    expect(groups[0]!.routes[0]).toContain('"_lazy-group-0-0"')
    // redirects keep working before discovery
    expect(routes).toContain(JSON.stringify('/parent'))
    expect(routes).not.toContain('import(')

    expect(groups[0]!.routes[0]).toContain('import("/app/pages/parent/child.vue")')
  })

  it('keeps file-less subtrees inline without adding them to a group', () => {
    const pages: NuxtPage[] = [
      { name: 'legacy', path: '/legacy', redirect: '/new', children: [] },
      { name: 'new', path: '/new', file: '/app/pages/new.vue', children: [] },
    ]

    const { routes, groups } = normalizeRoutesForLazyDiscovery(pages, options)

    expect(groups).toHaveLength(1)
    expect(groups[0]!.routes).toHaveLength(1)

    expect(routes).toContain('"legacy"')
    expect(routes).toContain(marker(0, 0))
  })

  it('keeps nameless, childless pages eager so vue-router does not drop their stubs', () => {
    const pages: NuxtPage[] = [
      { name: undefined, path: '/anonymous', file: '/app/pages/anonymous.vue', children: [] },
      { name: 'named', path: '/named', file: '/app/pages/named.vue', children: [] },
    ]

    const { routes, groups } = normalizeRoutesForLazyDiscovery(pages, options)

    expect(groups).toHaveLength(1)
    expect(groups[0]!.routes).toHaveLength(1)
    expect(routes).toContain('import("/app/pages/anonymous.vue")')
    expect(routes).not.toContain('import("/app/pages/named.vue")')
  })

  it('returns everything eager when overrideMeta is disabled', () => {
    const pages: NuxtPage[] = [
      { name: 'index', path: '/', file: '/app/pages/index.vue', children: [] },
    ]

    const { routes, imports, groups } = normalizeRoutesForLazyDiscovery(pages, { ...options, overrideMeta: false })

    expect(groups).toHaveLength(0)
    expect(routes).toContain('import("/app/pages/index.vue")')
    expect(imports.size).toBeGreaterThan(0)
  })
})
