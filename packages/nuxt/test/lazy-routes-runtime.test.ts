import { describe, expect, it, vi } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'
import { setupLazyRouteDiscovery } from '../src/pages/runtime/lazy-routes.ts'
import type { LazyRouteDiscoveryOptions } from '../src/pages/runtime/lazy-routes.ts'

const component = { render: () => null }

type Loader = () => Promise<{ default: RouteRecordRaw[] }>

function createLazyRouter (stubs: RouteRecordRaw[], loaders: Array<Loader | undefined>, options: LazyRouteDiscoveryOptions = {}) {
  const router = createRouter({ history: createMemoryHistory(), routes: stubs })
  const discovery = setupLazyRouteDiscovery(router, stubs, loaders, options)
  return { router, discovery }
}

function stub (path: string, name: string | undefined, group: number, position = 0): RouteRecordRaw {
  return { path, name, meta: { __nuxtRouteGroup: [group, position] } } as unknown as RouteRecordRaw
}

describe('setupLazyRouteDiscovery', () => {
  it('discovers a route group on navigation', async () => {
    const real: RouteRecordRaw = { path: '/about', name: 'about', meta: { title: 'about' }, component }
    const loader = vi.fn(() => Promise.resolve({ default: [real] }))
    const onDiscovery = vi.fn()

    const { router } = createLazyRouter([stub('/about', 'about', 0)], [loader], { onNavigationDiscovery: onDiscovery })
    await router.push('/about')

    expect(loader).toHaveBeenCalledTimes(1)
    expect(onDiscovery).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.meta.title).toBe('about')
    expect(router.currentRoute.value.matched[0]!.components?.default).toBe(component)
  })

  it('swaps all records of a batched group at once', async () => {
    const loader = vi.fn(() => Promise.resolve({
      default: [
        { path: '/a', name: 'a', component },
        { path: '/b', name: 'b', component },
      ] as RouteRecordRaw[],
    }))

    const { router } = createLazyRouter([stub('/a', 'a', 0, 0), stub('/b', 'b', 0, 1)], [loader])
    await router.push('/a')

    expect(loader).toHaveBeenCalledTimes(1)
    // the sibling record from the same group is already resolved
    expect(router.resolve('/b').matched[0]!.components?.default).toBe(component)
    await router.push('/b')
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('supports named navigation to undiscovered routes', async () => {
    const { router } = createLazyRouter(
      [stub('/', 'index', 0, 0), stub('/about', 'about', 0, 1)],
      [() => Promise.resolve({ default: [
        { path: '/', name: 'index', component },
        { path: '/about', name: 'about', component },
      ] as RouteRecordRaw[] })],
    )
    await router.push({ name: 'about' })

    expect(router.currentRoute.value.name).toBe('about')
    expect(router.currentRoute.value.matched[0]!.components?.default).toBe(component)
  })

  it('discovers nested routes through the parent marker', async () => {
    const real: RouteRecordRaw = {
      path: '/parent',
      component,
      children: [{ path: 'child', name: 'parent-child', meta: { nested: true }, component }],
    }
    const stubs = [{
      path: '/parent',
      meta: { __nuxtRouteGroup: [0, 0] },
      children: [{ path: 'child', name: 'parent-child' }],
    }] as unknown as RouteRecordRaw[]

    const { router } = createLazyRouter(stubs, [() => Promise.resolve({ default: [real] })])
    await router.push('/parent/child')

    expect(router.currentRoute.value.name).toBe('parent-child')
    expect(router.currentRoute.value.meta.nested).toBe(true)
    expect(router.currentRoute.value.matched).toHaveLength(2)
  })

  it('only loads a group once for concurrent navigations', async () => {
    const loader = vi.fn(() => Promise.resolve({ default: [{ path: '/a', name: 'a', component }] as RouteRecordRaw[] }))

    const { router, discovery } = createLazyRouter([stub('/a', 'a', 0)], [loader])
    await Promise.all([discovery.discover('/a'), discovery.discover('/a'), router.push('/a')])

    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('preserves routes added by user code across swaps', async () => {
    // unnamed real record forces the full-rebuild path
    const { router } = createLazyRouter(
      [stub('/a', 'a', 0)],
      [() => Promise.resolve({ default: [{ path: '/a', component }] as RouteRecordRaw[] })],
    )

    router.addRoute({ path: '/custom', name: 'custom', component })
    await router.push('/a')

    expect(router.resolve('/custom').name).toBe('custom')
    expect(router.resolve('/custom').matched).toHaveLength(1)
    expect(router.resolve('/a').matched[0]!.components?.default).toBe(component)
  })

  it('preserves user routes when a named swap is followed by a full rebuild', async () => {
    // unnamed parent wrappers (registrable through their children) force the rebuild path
    const parentStub = {
      path: '/b',
      meta: { __nuxtRouteGroup: [1, 0] },
      children: [{ path: 'child', name: 'b-child' }],
    } as unknown as RouteRecordRaw
    const { router } = createLazyRouter(
      [stub('/a', 'a', 0), parentStub],
      [
        () => Promise.resolve({ default: [{ path: '/a', name: 'a', component }] as RouteRecordRaw[] }),
        () => Promise.resolve({ default: [{ path: '/b', component, children: [{ path: 'child', name: 'b-child', component }] }] as RouteRecordRaw[] }),
      ],
    )

    router.addRoute({ path: '/custom', name: 'custom', component })
    // named atomic swap
    await router.push('/a')
    // unnamed swap → full rebuild
    await router.push('/b/child')

    expect(router.resolve('/custom').name).toBe('custom')
    expect(router.resolve('/a').matched[0]!.components?.default).toBe(component)
    expect(router.resolve('/b/child').matched.at(-1)!.components?.default).toBe(component)
  })

  it('discover() resolves records without navigating', async () => {
    const { router, discovery } = createLazyRouter(
      [stub('/a', 'a', 0)],
      [() => Promise.resolve({ default: [{ path: '/a', name: 'a', component }] as RouteRecordRaw[] })],
    )

    await discovery.discover('/a')

    expect(router.currentRoute.value.fullPath).toBe('/')
    expect(router.resolve('/a').matched[0]!.components?.default).toBe(component)
    // already discovered: nothing further to load
    expect(discovery.discover('/a')).toBeUndefined()
  })

  it('retries a failed group load on the next navigation', async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce({ default: [{ path: '/a', name: 'a', component }] })

    const { router } = createLazyRouter([stub('/a', 'a', 0)], [loader])
    const onError = vi.fn()
    router.onError(onError)

    await router.push('/a').catch(() => {})
    expect(onError).toHaveBeenCalled()

    await router.push({ path: '/a', force: true })
    expect(loader).toHaveBeenCalledTimes(2)
    expect(router.resolve('/a').matched[0]!.components?.default).toBe(component)
  })

  it('matches identically to the full route table before discovery', () => {
    const full = [
      { path: '/', name: 'index', component },
      { path: '/about', name: 'about', alias: ['/about-us'], component },
      { path: '/blog/:slug', name: 'blog-slug', component },
      { path: '/docs/:path(.*)*', name: 'docs-catchall', component },
      {
        path: '/parent',
        component,
        children: [
          { path: '', name: 'parent-index', component },
          { path: 'child/:id', name: 'parent-child', component },
        ],
      },
      { path: '/old', name: 'old', redirect: '/about', component },
    ] as RouteRecordRaw[]

    // stubs mirror matching-relevant fields only, the way the generator emits them
    const stubs = [
      { path: '/', name: 'index', meta: { __nuxtRouteGroup: [0, 0] } },
      { path: '/about', name: 'about', alias: ['/about-us'], meta: { __nuxtRouteGroup: [0, 1] } },
      { path: '/blog/:slug', name: 'blog-slug', meta: { __nuxtRouteGroup: [0, 2] } },
      { path: '/docs/:path(.*)*', name: 'docs-catchall', meta: { __nuxtRouteGroup: [0, 3] } },
      {
        path: '/parent',
        meta: { __nuxtRouteGroup: [0, 4] },
        children: [
          { path: '', name: 'parent-index' },
          { path: 'child/:id', name: 'parent-child' },
        ],
      },
      { path: '/old', name: 'old', redirect: '/about', meta: { __nuxtRouteGroup: [0, 5] } },
    ] as unknown as RouteRecordRaw[]

    const fullRouter = createRouter({ history: createMemoryHistory(), routes: full })
    const { router: stubRouter } = createLazyRouter(stubs, [() => Promise.resolve({ default: full })])

    for (const path of ['/', '/about', '/about-us', '/blog/hello', '/docs/a/b/c', '/docs', '/parent', '/parent/child/42', '/unknown/route']) {
      const expected = fullRouter.resolve(path)
      const actual = stubRouter.resolve(path)
      expect(actual.name, `name for ${path}`).toBe(expected.name)
      expect(actual.params, `params for ${path}`).toEqual(expected.params)
      expect(actual.matched.length, `matched for ${path}`).toBe(expected.matched.length)
    }
  })

  it('handles hundreds of routes and groups without losing records', async () => {
    const groupSize = 10
    const routeCount = 500
    const stubs: RouteRecordRaw[] = []
    const loaders: Loader[] = []
    for (let group = 0; group < routeCount / groupSize; group++) {
      const records: RouteRecordRaw[] = []
      for (let position = 0; position < groupSize; position++) {
        const i = group * groupSize + position
        stubs.push(stub(`/page-${i}`, `page-${i}`, group, position))
        records.push({ path: `/page-${i}`, name: `page-${i}`, component })
      }
      loaders.push(() => Promise.resolve({ default: records }))
    }

    const { router } = createLazyRouter(stubs, loaders)
    router.addRoute({ path: '/custom', name: 'custom', component })

    // discover every 5th group through navigation
    for (let i = 0; i < routeCount; i += groupSize * 5) {
      await router.push(`/page-${i}`)
      expect(router.currentRoute.value.name).toBe(`page-${i}`)
    }

    expect(router.getRoutes()).toHaveLength(routeCount + 1)
    expect(router.resolve('/custom').name).toBe('custom')
    // undiscovered stubs still match
    expect(router.resolve(`/page-${routeCount - 1}`).name).toBe(`page-${routeCount - 1}`)
  })

  it('leaves user routes with aliases and nested children untouched by named swaps', async () => {
    const { router } = createLazyRouter(
      [stub('/a', 'a', 0)],
      [() => Promise.resolve({ default: [{ path: '/a', name: 'a', component }] as RouteRecordRaw[] })],
    )

    router.addRoute({ path: '/custom', name: 'custom', alias: ['/custom-alias'], component })
    router.addRoute({
      path: '/user-parent',
      name: 'user-parent',
      component,
      children: [{ path: 'child', name: 'user-child', component }],
    })

    // named atomic swap: must not rebuild the table
    await router.push('/a')

    expect(router.resolve('/custom').name).toBe('custom')
    expect(router.resolve('/custom-alias').name).toBe('custom')
    expect(router.resolve('/user-parent/child').matched).toHaveLength(2)
    expect(router.resolve('/user-parent/child').name).toBe('user-child')
  })

  it('does not loop when a group chunk is missing a record for its marker', async () => {
    // simulates build skew: the chunk no longer contains the record at the marker position
    const loader = vi.fn(() => Promise.resolve({ default: [] as RouteRecordRaw[] }))
    const { router } = createLazyRouter([stub('/a', 'a', 0)], [loader])

    // must settle (no infinite redirect loop) even though the stub can never be swapped
    await router.push('/a').catch(() => {})
    expect(loader).toHaveBeenCalledTimes(1)

    // a later navigation does not re-fetch the settled group
    await router.push({ path: '/a', force: true }).catch(() => {})
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('reset() swaps in new stubs and loaders and refreshes the current route', async () => {
    const { router, discovery } = createLazyRouter(
      [stub('/a', 'a', 0)],
      [() => Promise.resolve({ default: [{ path: '/a', name: 'a', meta: { title: 'old' }, component }] as RouteRecordRaw[] })],
    )
    router.addRoute({ path: '/custom', name: 'custom', component })
    await router.push('/a')
    expect(router.currentRoute.value.meta.title).toBe('old')

    // simulate a dev-time route tree regeneration
    await discovery.reset(
      [stub('/a', 'a', 0), stub('/added', 'added', 0, 1)],
      [() => Promise.resolve({ default: [
        { path: '/a', name: 'a', meta: { title: 'new' }, component },
        { path: '/added', name: 'added', component },
      ] as RouteRecordRaw[] })],
    )

    expect(router.currentRoute.value.meta.title).toBe('new')
    expect(router.resolve('/custom').name).toBe('custom')

    await router.push('/added')
    expect(router.currentRoute.value.matched[0]!.components?.default).toBe(component)
  })

  it('reset() re-discovers the current route via the endpoint when the new table omits it', async () => {
    // dev HMR under fog of war: the regenerated client table ships only eager routes, so the current
    // (discovered) route is not in it — reset must re-discover it through the transport
    const resolveRemote = vi.fn(() => Promise.resolve({ records: [stub('/a', 'a', 0, 0)] }))
    const { router, discovery } = createLazyRouter(
      [stub('/a', 'a', 0, 0)],
      [() => Promise.resolve({ default: [{ path: '/a', name: 'a', component }] as RouteRecordRaw[] })],
      { resolveRemote },
    )
    await router.push('/a')
    expect(router.currentRoute.value.name).toBe('a')

    resolveRemote.mockClear()
    await discovery.reset([], [() => Promise.resolve({ default: [{ path: '/a', name: 'a', component }] as RouteRecordRaw[] })])

    expect(resolveRemote).toHaveBeenCalledWith({ paths: ['/a'] })
    expect(router.resolve('/a').matched[0]!.components?.default).toBe(component)
  })

  describe('stub discovery via resolveRemote (fog of war)', () => {
    it('fetches an undiscovered stub on navigation, then loads its group', async () => {
      const resolveRemote = vi.fn(() => Promise.resolve({ records: [stub('/about', 'about', 0, 1)] }))
      const { router } = createLazyRouter(
        [stub('/', 'index', 0, 0)], // client boots knowing ONLY the current route
        [() => Promise.resolve({ default: [
          { path: '/', name: 'index', component },
          { path: '/about', name: 'about', meta: { title: 'about' }, component },
        ] as RouteRecordRaw[] })],
        { resolveRemote },
      )

      // /about is unknown at boot
      expect(router.resolve('/about').matched).toHaveLength(0)

      await router.push('/about')

      expect(resolveRemote).toHaveBeenCalledWith({ paths: ['/about'] })
      expect(router.currentRoute.value.name).toBe('about')
      expect(router.currentRoute.value.meta.title).toBe('about')
      expect(router.currentRoute.value.matched[0]!.components?.default).toBe(component)
    })

    it('does not query for an already-known route', async () => {
      const resolveRemote = vi.fn(() => Promise.resolve({ records: [] as RouteRecordRaw[] }))
      const { router } = createLazyRouter(
        [stub('/about', 'about', 0)],
        [() => Promise.resolve({ default: [{ path: '/about', name: 'about', component }] as RouteRecordRaw[] })],
        { resolveRemote },
      )

      await router.push('/about')
      expect(resolveRemote).not.toHaveBeenCalled()
    })

    it('catch-all guard: discovers a specific route even when a catch-all stub is present', async () => {
      const resolveRemote = vi.fn(() => Promise.resolve({ records: [stub('/blog/:slug', 'blog-slug', 1, 0)] }))
      const { router } = createLazyRouter(
        [stub('/', 'index', 0, 0), { path: '/:catchall(.*)*', name: 'catchall', meta: { __nuxtRouteGroup: [2, 0] } } as unknown as RouteRecordRaw],
        [
          () => Promise.resolve({ default: [{ path: '/', name: 'index', component }] as RouteRecordRaw[] }),
          () => Promise.resolve({ default: [{ path: '/blog/:slug', name: 'blog-slug', component }] as RouteRecordRaw[] }),
        ],
        { resolveRemote },
      )

      // locally, /blog/hello matches only the catch-all — the trap
      expect(router.resolve('/blog/hello').name).toBe('catchall')

      await router.push('/blog/hello')

      expect(resolveRemote).toHaveBeenCalledWith({ paths: ['/blog/hello'] })
      expect(router.currentRoute.value.name).toBe('blog-slug')
    })

    it('negative-caches an unresolvable path so it is queried only once', async () => {
      const resolveRemote = vi.fn(() => Promise.resolve({ records: [] as RouteRecordRaw[] }))
      const { router } = createLazyRouter([stub('/', 'index', 0, 0)], [undefined], { resolveRemote })

      await router.push('/missing').catch(() => {})
      await router.push({ path: '/missing', force: true }).catch(() => {})

      expect(resolveRemote).toHaveBeenCalledTimes(1)
    })

    it('shares one request across concurrent discovery of the same path', async () => {
      const resolveRemote = vi.fn(() => Promise.resolve({ records: [stub('/about', 'about', 0, 1)] }))
      const { router, discovery } = createLazyRouter(
        [stub('/', 'index', 0, 0)],
        [() => Promise.resolve({ default: [
          { path: '/', name: 'index', component },
          { path: '/about', name: 'about', component },
        ] as RouteRecordRaw[] })],
        { resolveRemote },
      )

      await Promise.all([discovery.discover('/about'), discovery.discover('/about'), router.push('/about')])

      expect(resolveRemote).toHaveBeenCalledTimes(1)
      expect(router.resolve('/about').matched[0]!.components?.default).toBe(component)
    })

    it('discover() prefetches an undiscovered stub without navigating', async () => {
      const resolveRemote = vi.fn(() => Promise.resolve({ records: [stub('/about', 'about', 0, 1)] }))
      const { router, discovery } = createLazyRouter(
        [stub('/', 'index', 0, 0)],
        [() => Promise.resolve({ default: [
          { path: '/', name: 'index', component },
          { path: '/about', name: 'about', component },
        ] as RouteRecordRaw[] })],
        { resolveRemote },
      )

      await discovery.discover('/about')

      expect(resolveRemote).toHaveBeenCalledWith({ paths: ['/about'] })
      expect(router.currentRoute.value.fullPath).toBe('/')
      expect(router.resolve('/about').matched[0]!.components?.default).toBe(component)
    })

    it('does not crash when the transport is unreachable (returns undefined)', async () => {
      const resolveRemote = vi.fn(() => Promise.resolve(undefined))
      const { router } = createLazyRouter([stub('/', 'index', 0, 0)], [undefined], { resolveRemote })

      await router.push('/missing').catch(() => {})
      // path is negative-cached: a second navigation does not re-query
      await router.push({ path: '/missing', force: true }).catch(() => {})
      expect(resolveRemote).toHaveBeenCalledTimes(1)
    })

    it('discovers a route by name for named navigation to an undiscovered route', async () => {
      const resolveRemote = vi.fn(() => Promise.resolve({ records: [stub('/about', 'about', 0, 1)] }))
      const { router, discovery } = createLazyRouter(
        [stub('/', 'index', 0, 0)],
        [() => Promise.resolve({ default: [
          { path: '/', name: 'index', component },
          { path: '/about', name: 'about', component },
        ] as RouteRecordRaw[] })],
        { resolveRemote },
      )

      // the name is unknown at boot; discovering it (as the push/replace wrapper does) queries by name
      expect(router.hasRoute('about')).toBe(false)
      await discovery.discover({ name: 'about' })

      expect(resolveRemote).toHaveBeenCalledWith({ names: ['about'] })
      expect(router.hasRoute('about')).toBe(true)

      await router.push({ name: 'about' })
      expect(router.currentRoute.value.name).toBe('about')
      expect(router.currentRoute.value.matched[0]!.components?.default).toBe(component)
    })
  })
})
