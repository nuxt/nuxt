import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import type { RouteLocationNormalizedLoaded, RouteRecordRaw } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'
import { augmentPages, createPagesContext, dynamicPageMetaCache, getDynamicPageMeta, getPageComponentNames, normalizeRoutes, relativizeToParent, resolveRoutePaths } from '../src/pages/utils.ts'
import { PageComponentNamePlugin } from '../src/pages/plugins/component-name.ts'
import type { RouterViewSlotProps } from '../src/pages/runtime/utils.ts'
import { generateRouteKey, memoizeRouteComponent } from '../src/pages/runtime/utils.ts'
import type { Nuxt, NuxtPage } from 'nuxt/schema'
import { useNuxt } from '@nuxt/kit'
import fc from 'fast-check'
import { joinURL, withoutTrailingSlash } from 'ufo'

const mockNuxt = vi.hoisted(() => ({
  options: {
    experimental: {
      normalizePageNames: false,
    },
  },
}))
vi.mock('@nuxt/kit', async (original) => {
  const mod = await original<typeof import('@nuxt/kit')>()
  return {
    ...mod,
    useNuxt: vi.fn(() => mockNuxt),
  }
})

vi.mock('knitwork', async (original) => {
  return {
    ...(await original<typeof import('knitwork')>()),
    genArrayFromRaw: (val: any) => val,
    genSafeVariableName: (..._args: string[]) => {
      return 'mock'
    },
  }
})

/** `augmentPages`, tied to the mocked nuxt instance the way `augmentAndResolve` ties it to a real one. */
function augmentForNuxt (pages: NuxtPage[], vfs: Record<string, string>, ctx: Parameters<typeof augmentPages>[2] = {}) {
  return augmentPages(pages, vfs, { nuxt: mockNuxt as unknown as Nuxt, ...ctx })
}

function dynamicMetaFor (page: NuxtPage) {
  return getDynamicPageMeta(page, dynamicPageMetaCache(mockNuxt as unknown as Nuxt))
}

function generate (pages: NuxtPage[], overrideMeta?: boolean) {
  return normalizeRoutes(pages, new Set(), {
    clientComponentRuntime: '<client-component-runtime>',
    serverComponentRuntime: '<server-component-runtime>',
    overrideMeta,
  })
}

interface PageTest {
  description: string
  files?: Array<{ path: string, template?: string, meta?: Record<string, any> }>
  output?: Array<NuxtPage & { dynamic?: string[] }>
  error?: string
}

async function resolvePageTest (test: PageTest): Promise<NuxtPage[]> {
  if (!test.files) {
    return structuredClone(test.output!)
  }
  const ctx = createPagesContext({ roots: ['pages/', 'layer/pages/'] })
  ctx.rebuild(test.files.map(file => ({ path: file.path })))
  const pages = ctx.emit().map((route, index) => ({ ...route, meta: test.files![index]!.meta ?? route.meta }))
  await augmentForNuxt(pages, Object.fromEntries(test.files.map(file => [file.path, file.template ?? ''])), { extraExtractionKeys: new Set(['extracted']) })
  return pages
}

const enUSComparator = new Intl.Collator('en-US')

/** Sort routes by path, omitting empty children, and optionally surface the dynamic keys recorded for their files. */
function toComparable (routes: NuxtPage[], withDynamic = false): Array<NuxtPage & { dynamic?: string[] }> {
  return routes.map(({ children, ...route }) => {
    const dynamic = withDynamic ? dynamicMetaFor(route) : new Set()
    return {
      ...route,
      ...dynamic.size ? { dynamic: [...dynamic] } : {},
      ...children?.length ? { children: toComparable(children, withDynamic) } : {},
    }
  }).toSorted((a, b) => enUSComparator.compare(b.path, a.path))
}

function sortNormalized (routes: any[]): any[] {
  return routes
    .map(route => route?.children ? { ...route, children: sortNormalized(route.children) } : route)
    .toSorted((a, b) => enUSComparator.compare(JSON.stringify(b), JSON.stringify(a)))
}

describe('pages:generateRoutesFromFiles', () => {
  for (const test of pageTests) {
    it(test.description, async () => {
      if (test.error) {
        await expect(resolvePageTest(test)).rejects.toThrow(test.error)
      } else {
        expect(toComparable(await resolvePageTest(test), !!test.files)).toEqual(toComparable(test.output!))
      }
    })
  }

  it('should consistently normalize routes with page metadata', async () => {
    const normalized: Record<string, Record<string, any>> = { fallback: {}, overrideMeta: {} }
    for (const test of pageTests) {
      if (test.error || (test.files && !test.files.some(file => file.template || file.meta))) { continue }
      const pages = await resolvePageTest(test)
      normalized.fallback![test.description] = sortNormalized(generate(pages, false).routes as any)
      normalized.overrideMeta![test.description] = sortNormalized(generate(pages, true).routes as any)
    }
    await expect(normalized).toMatchFileSnapshot('./__snapshots__/pages-normalize-routes.snap')
  })
})

describe('pages:normalizePageNames', () => {
  it.each<[description: string, page: Partial<NuxtPage>, contains: string[], excludes: string[], scanPageMeta?: boolean]>([
    ['assign `__name` via `Object.assign` for sync imports', { _sync: true }, ['Object.assign(', '__name'], []],
    ['assign `__name` to the default export of async imports', {}, ['.then((m) => Object.assign(m.default', '__name'], []],
    ['use `createIslandPage` without `__name` for server pages', { mode: 'server' }, ['createIslandPage('], ['__name', '.then']],
    ['assign `__name` to the resolved component for client pages', { mode: 'client' }, ['createClientPage(', '.then((c) => Object.assign(c,', '__name'], ['m.default']],
    ['omit the runtime assignment when the name is known at build time', {}, [], ['Object.assign', '__name', '.then'], true],
    ['omit the runtime assignment for client pages when the name is known at build time', { mode: 'client' }, ['createClientPage('], ['Object.assign', '__name'], true],
  ])('should %s', (_, page, contains, excludes, scanPageMeta) => {
    vi.mocked(useNuxt).mockReturnValueOnce({ options: { experimental: { normalizePageNames: true, scanPageMeta } } } as unknown as Nuxt)
    const [route] = generate([{ file: '/pages/page.vue', name: 'page', path: '/page', ...page }], scanPageMeta).routes as any
    for (const text of contains) {
      expect(route.component).toContain(text)
    }
    for (const text of excludes) {
      expect(route.component).not.toContain(text)
    }
  })

  it('keeps the runtime assignment when the page name is set dynamically', () => {
    const nuxt = { options: { experimental: { normalizePageNames: true, scanPageMeta: true } } } as unknown as Nuxt
    const cache = dynamicPageMetaCache(nuxt)
    cache.set('/pages/async.vue', new Set(['name']))
    const pages: NuxtPage[] = [{ file: '/pages/async.vue', name: 'async', path: '/async' }]

    vi.mocked(useNuxt).mockReturnValueOnce(nuxt)
    const [route] = generate(pages, true).routes as any
    expect(route.component).toContain('.then((m) => Object.assign(m.default')
    expect(route.component).toContain('__name: mockMeta?.name ?? "async"')

    // once the name is static, the runtime assignment is dropped
    cache.delete('/pages/async.vue')
    vi.mocked(useNuxt).mockReturnValueOnce(nuxt)
    const [staticRoute] = generate(pages, true).routes as any
    expect(staticRoute.component).not.toContain('Object.assign')
  })

  it('keeps the runtime assignment when a page file is reused with different names', () => {
    vi.mocked(useNuxt).mockReturnValueOnce({ options: { experimental: { normalizePageNames: true, scanPageMeta: true } } } as unknown as Nuxt)
    const routes = generate([
      { file: '/pages/shared.vue', name: 'first', path: '/first' },
      { file: '/pages/shared.vue', name: 'second', path: '/second' },
    ], true).routes as any

    expect(routes[0].component).toContain('Object.assign')
    expect(routes[1].component).toContain('Object.assign')
  })
})

describe('pages:page-component-name', () => {
  function transform (code: string) {
    const nuxt = {
      apps: { default: { pages: [{ file: '/pages/foo.vue', name: 'foo', path: '/' } as NuxtPage] } },
      options: { experimental: { scanPageMeta: true } },
    } as unknown as Nuxt
    const plugin = PageComponentNamePlugin({ nuxt }).raw({}, { framework: 'vite', versions: {} } as any) as {
      transform: { handler: (code: string, id: string) => { code: string } | undefined }
    }
    return plugin.transform.handler(code, '/pages/foo.vue')?.code
  }

  it.each([
    ['set the route name on an identifier default export', 'const _sfc_main = {}\nexport default _sfc_main', 'const _sfc_main = {}\nexport default Object.assign(_sfc_main, { __name: "foo" })'],
    ['wrap an object default export', 'export default { render: () => null }', 'export default Object.assign({ render: () => null }, { __name: "foo" })'],
    ['not touch an unrelated `__name`', 'const other = { __name: "foo" }\nexport default { render: () => other }', 'const other = { __name: "foo" }\nexport default Object.assign({ render: () => other }, { __name: "foo" })'],
  ])('should %s', (_, code, expected) => {
    expect(transform(code)).toBe(expected)
  })
})

describe('pages:pageComponentNames', () => {
  const nuxt = { options: { experimental: { scanPageMeta: true } } } as unknown as Nuxt

  it('excludes a page file that another route uses as a named view', () => {
    const names = getPageComponentNames([
      { file: '/pages/foo.vue', name: 'foo', path: '/foo' },
      { file: '/pages/bar.vue', name: 'bar', path: '/bar', components: { default: '/pages/bar.vue', foo: '/pages/foo.vue' } },
    ], nuxt)
    expect(names.get('/pages/foo.vue')).toBeUndefined()
    expect(names.get('/pages/bar.vue')).toBe('bar')
  })

  it('excludes a symlinked page file', () => {
    const spy = vi.spyOn(fs, 'realpathSync').mockReturnValue('/real/foo.vue')
    try {
      expect(getPageComponentNames([{ file: '/pages/foo.vue', name: 'foo', path: '/foo' }], nuxt).get('/pages/foo.vue')).toBeUndefined()
    } finally {
      spy.mockRestore()
    }
  })
})

describe('pages:namedViews', () => {
  it('emits a `components` map alongside `component` when the scanner reports named views', () => {
    const [route] = generate([{
      name: 'foo-bar',
      path: 'bar',
      file: '/pages/foo/bar.vue',
      components: { default: '/pages/foo/bar.vue', left: '/pages/foo/bar@left.vue' },
    }]).routes as any
    expect(route.component).toBe('() => import("/pages/foo/bar.vue")')
    expect(route.components).toBe('{ default: () => import("/pages/foo/bar.vue"), "left": () => import("/pages/foo/bar@left.vue") }')
  })

  it('does not emit `components` when only the default view is present', () => {
    const [route] = generate([{
      name: 'foo-bar',
      path: 'bar',
      file: '/pages/foo/bar.vue',
      components: { default: '/pages/foo/bar.vue' },
    }]).routes as any
    expect(route.component).toBeTruthy()
    expect(route.components).toBeUndefined()
  })
})

describe('pages:generateRouteKey', () => {
  const defaultComponent = { type: {} }
  const getRouteProps = (matchedRoute = {}) => ({
    Component: defaultComponent,
    route: {
      meta: { key: 'route-meta-key' },
      params: {
        id: 'foo',
        optional: 'bar',
        array: ['a', 'b'],
      },
      matched: [
        {
          components: { default: {} },
          meta: { key: 'other-meta-key' },
        },
        {
          components: { default: defaultComponent.type },
          meta: { key: 'matched-meta-key' },
          ...matchedRoute,
        },
      ],
    },
  } as unknown as RouterViewSlotProps)

  it.each<[description: string, override: string | ((route: RouteLocationNormalizedLoaded) => string) | undefined, output: string | false]>([
    ['use a string override as the key', 'key', 'key'],
    ['use the result of a function override as the key', route => route.meta.key as string, 'route-meta-key'],
    // @ts-expect-error testing behaviour with invalid prop
    ['return `false` for a `false` override', false, false],
  ])('should %s', (_, override, output) => {
    expect(generateRouteKey(getRouteProps(), override)).toEqual(output)
  })

  it.each([
    ['an unkeyed dynamic route by its param value', '/test/:id', '/test/foo'],
    ['an unkeyed dynamic route with a custom matcher by its param value', '/test/:id(\\d+)', '/test/foo'],
    ['an optional param by its value', '/test/:optional?', '/test/bar'],
    ['an optional param with a custom matcher by its value', '/test/:optional(\\d+)?', '/test/bar'],
    ['an unmatched optional param as an empty segment', '/test/:undefined(\\d+)?', '/test/'],
    ['the joined values of a one-or-more repeatable param', '/:array+', '/a,b'],
    ['the joined values of a zero-or-more repeatable param', '/test/:array*', '/test/a,b'],
    ['an unmatched zero-or-more repeatable param as an empty segment', '/test/:other*', '/test/'],
  ])('should key %s', (_, path, output) => {
    expect(generateRouteKey(getRouteProps({ path, meta: {} }))).toEqual(output)
  })
})

describe('pages:memoizeRouteComponent', () => {
  const Parent = { name: 'Parent', render: () => null }
  const Child = { name: 'Child', render: () => null }

  async function resolveWithNewRouter (routes: RouteRecordRaw[], path: string) {
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.onError(() => {})
    await router.push(path)
    return router.currentRoute.value.matched.map(m => m.components?.default)
  }

  it('should wrap lazy page components when given a runtime', () => {
    const { routes, imports } = normalizeRoutes([
      { name: 'lazy', path: '/lazy', file: '/pages/lazy.vue' },
      { name: 'sync', path: '/sync', file: '/pages/sync.vue', _sync: true },
    ], new Set(), {
      clientComponentRuntime: '<client>',
      serverComponentRuntime: '<server>',
      routeComponentRuntime: '<route-component>',
    })

    expect((routes as unknown as Array<{ component: string }>).map(r => r.component)).toEqual([
      'import.meta.server ? _memoizeRouteComponent(() => import("/pages/lazy.vue")) : () => import("/pages/lazy.vue")',
      'mock',
    ])
    expect(imports).toContain('import { memoizeRouteComponent as _memoizeRouteComponent } from "<route-component>";')
  })

  it('should share lazy component imports between routers', async () => {
    const loadParent = vi.fn(() => Promise.resolve({ default: Parent }))
    const loadChild = vi.fn(() => Promise.resolve({ default: Child }))
    const routes: RouteRecordRaw[] = [{ path: '/parent', component: memoizeRouteComponent(loadParent), children: [{ path: 'child', component: memoizeRouteComponent(loadChild) }] }]

    expect(await resolveWithNewRouter(routes, '/parent/child')).toEqual([Parent, Child])
    expect(await resolveWithNewRouter(routes, '/parent/child')).toEqual([Parent, Child])
    expect(loadParent).toHaveBeenCalledTimes(1)
    expect(loadChild).toHaveBeenCalledTimes(1)
  })

  it('should retry a lazy component import after it rejects', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('failed to load'))
      .mockResolvedValue({ default: Child })
    const routes: RouteRecordRaw[] = [{ path: '/', component: memoizeRouteComponent(load) }]

    await expect(resolveWithNewRouter(routes, '/')).rejects.toThrow('failed to load')
    expect(await resolveWithNewRouter(routes, '/')).toEqual([Child])
    expect(await resolveWithNewRouter(routes, '/')).toEqual([Child])
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe('pages:relativizeToParent', () => {
  const tests: Array<[parentFullPath: string, childPath: string, expected: string | undefined]> = [
    ['/parent', '/parent/child', 'child'],
    ['/parent/:id()', '/parent/:id/child', 'child'],
    ['/parent/:id', '/parent/:id()/child', 'child'],
    ['/parent/:id()+', '/parent/:id+/child', 'child'],
    ['/parent/:id(\\d+)', '/parent/:id(\\d+)/child', 'child'],
    ['/parent/:id()', '/parent/:id()/:childId?/child', ':childId?/child'],
    ['/parent', 'relative/child', 'relative/child'],
    ['/', '/child', 'child'],
    ['/parent/:id()', '/parent/:id(\\d+)/child', undefined],
    ['/parent', '/detached', undefined],
    ['/parent', '/parent-sibling/child', undefined],
    ['/parent/:id()', '/parent', undefined],
  ]
  it.each(tests)('should relativize %s + %s to %s', (parentFullPath, childPath, expected) => {
    expect(relativizeToParent(parentFullPath, childPath)).toBe(expected)
  })

  const segment = fc.constantFrom(
    'a', 'b', 'foo', 'foo-bar', 'foobar', '测试', '%E6%B5%8B', 'a.b', '(group)',
    ':id', ':id()', ':id?', ':id+', ':id*', ':id(\\d+)', ':slug()', ':slug?', ':pathMatch(.*)*',
  )
  const routePath = fc.array(segment, { maxLength: 4 }).map(segments => '/' + segments.join('/'))
  const parentPath = fc.oneof(routePath, routePath.map(path => path === '/' ? path : path + '/'))
  const canonicalize = (path: string) => withoutTrailingSlash(path.replace(/:(\w+)\(\)([+*?]?)/g, ':$1$2')) || '/'
  const splitSegments = (path: string) => {
    const segments = canonicalize(path).split('/')
    return segments.at(-1) === '' ? segments.slice(0, -1) : segments
  }

  it('should return a remainder that rejoins with the parent to give the child path', () => {
    fc.assert(fc.property(parentPath, routePath, (parentFullPath, childPath) => {
      const remainder = relativizeToParent(parentFullPath, childPath)
      fc.pre(remainder !== undefined)
      expect(canonicalize(joinURL(parentFullPath, remainder!))).toBe(canonicalize(childPath))
    }), { numRuns: 1000 })
  })

  it('should always relativize a child path that extends the parent path', () => {
    fc.assert(fc.property(parentPath, fc.array(segment, { minLength: 1, maxLength: 3 }), (parentFullPath, extraSegments) => {
      const childPath = joinURL(parentFullPath, extraSegments.join('/'))
      expect(relativizeToParent(parentFullPath, childPath)).toBe(extraSegments.join('/'))
    }), { numRuns: 1000 })
  })

  it('should only return undefined for a child path detached from the parent', () => {
    fc.assert(fc.property(parentPath, routePath, (parentFullPath, childPath) => {
      const parentSegments = splitSegments(parentFullPath)
      const childSegments = splitSegments(childPath)
      const extendsParent = parentSegments.every((segment, index) => segment === childSegments[index])
      expect(relativizeToParent(parentFullPath, childPath) !== undefined).toBe(extendsParent)
    }), { numRuns: 1000 })
  })

  it('should resolve every route path in a page tree to a normalized absolute path', () => {
    const page: fc.Arbitrary<NuxtPage> = fc.letrec<{ page: NuxtPage }>(tie => ({
      page: fc.record({
        path: fc.oneof(segment, segment.map(s => '/' + s)),
        children: fc.oneof(fc.constant(undefined), fc.array(tie('page'), { maxLength: 2 })),
      }),
    })).page
    fc.assert(fc.property(page, (page) => {
      for (const path of resolveRoutePaths(page)) {
        expect(path.startsWith('/')).toBe(true)
        expect(path).not.toContain('//')
      }
    }), { numRuns: 1000 })
  })
})

describe('page:extends', () => {
  it('should preserve distinct metadata for multiple routes referencing the same file', async () => {
    const files: NuxtPage[] = [
      { path: 'home', file: `pages/index.vue` },
      { path: 'home1', file: `pages/index.vue`, meta: { test: true } },
      { path: 'home2', file: `pages/index.vue`, meta: { snap: true } },
    ]
    await augmentForNuxt(files, { 'pages/index.vue': `<script setup lang="ts">definePageMeta({ hello: 'world' })</script>` })
    expect(files).toEqual([
      { path: 'home', file: `pages/index.vue` },
      { path: 'home1', file: `pages/index.vue`, meta: { test: true } },
      { path: 'home2', file: `pages/index.vue`, meta: { snap: true } },
    ])
    for (const file of files) {
      expect(dynamicMetaFor(file)).toEqual(new Set(['meta']))
    }
  })

  it('keeps an explicit route name/path when reusing a file with a `definePageMeta` name (#27358)', async () => {
    const files: NuxtPage[] = [
      { path: '/test', file: 'pages/test.vue' },
      { path: '/testExtend', name: 'testExtend', file: 'pages/test.vue' },
    ]
    await augmentForNuxt(files, { 'pages/test.vue': `<script setup lang="ts">definePageMeta({ name: 'test' })</script>` })
    // first route takes the file's name; the second keeps its own, else both are `test` -> dropped
    expect(files[0]!.name).toBe('test')
    expect(files[1]!.name).toBe('testExtend')
    expect(files[1]!.path).toBe('/testExtend')
  })
})

const pagesDir = 'pages'
const layerDir = 'layer/pages'
const pageTests: PageTest[] = [
  {
    description: 'should generate correct routes for index pages',
    files: [
      { path: `${pagesDir}/index.vue` },
      { path: `${pagesDir}/parent/index.vue` },
      { path: `${pagesDir}/parent/child/index.vue` },
    ],
    output: [
      { name: 'index', path: '/', file: `${pagesDir}/index.vue` },
      { name: 'parent', path: '/parent', file: `${pagesDir}/parent/index.vue` },
      { name: 'parent-child', path: '/parent/child', file: `${pagesDir}/parent/child/index.vue` },
    ],
  },
  {
    description: 'should generate correct routes for parent/child',
    files: [
      { path: `${pagesDir}/parent.vue` },
      { path: `${pagesDir}/parent/child.vue` },
    ],
    output: [
      {
        name: 'parent',
        path: '/parent',
        file: `${pagesDir}/parent.vue`,
        children: [{ name: 'parent-child', path: 'child', file: `${pagesDir}/parent/child.vue` }],
      },
    ],
  },
  {
    description: 'should not generate colliding route names when hyphens are in file name',
    files: [
      { path: `${pagesDir}/parent/[child].vue` },
      { path: `${pagesDir}/parent-[child].vue` },
    ],
    output: [
      { name: 'parent-child', path: '/parent/:child()', file: `${pagesDir}/parent/[child].vue` },
      { name: 'parent-child', path: '/parent-:child()', file: `${pagesDir}/parent-[child].vue` },
    ],
  },
  {
    description: 'should generate correct id for catchall (order 1)',
    files: [
      { path: `${pagesDir}/[...stories].vue` },
      { path: `${pagesDir}/stories/[id].vue` },
    ],
    output: [
      { name: 'stories', path: '/:stories(.*)*', file: `${pagesDir}/[...stories].vue` },
      { name: 'stories-id', path: '/stories/:id()', file: `${pagesDir}/stories/[id].vue` },
    ],
  },
  {
    description: 'should generate correct id for catchall (order 2)',
    files: [
      { path: `${pagesDir}/stories/[id].vue` },
      { path: `${pagesDir}/[...stories].vue` },
    ],
    output: [
      { name: 'stories-id', path: '/stories/:id()', file: `${pagesDir}/stories/[id].vue` },
      { name: 'stories', path: '/:stories(.*)*', file: `${pagesDir}/[...stories].vue` },
    ],
  },
  {
    description: 'should generate correct route for snake_case and kebab-case files',
    files: [
      { path: `${pagesDir}/snake_case.vue` },
      { path: `${pagesDir}/kebab-case.vue` },
    ],
    output: [
      { name: 'snake_case', path: '/snake_case', file: `${pagesDir}/snake_case.vue` },
      { name: 'kebab-case', path: '/kebab-case', file: `${pagesDir}/kebab-case.vue` },
    ],
  },
  {
    description: 'should generate correct dynamic routes',
    files: [
      { path: `${pagesDir}/index.vue` },
      { path: `${pagesDir}/[slug].vue` },
      { path: `${pagesDir}/[[foo]]` },
      { path: `${pagesDir}/[[foo]]/index.vue` },
      { path: `${pagesDir}/optional/[[opt]].vue` },
      { path: `${pagesDir}/optional/prefix-[[opt]].vue` },
      { path: `${pagesDir}/optional/[[opt]]-postfix.vue` },
      { path: `${pagesDir}/optional/prefix-[[opt]]-postfix.vue` },
      { path: `${pagesDir}/[bar]/index.vue` },
      { path: `${pagesDir}/nonopt/[slug].vue` },
      { path: `${pagesDir}/opt/[[slug]].vue` },
      { path: `${pagesDir}/[[sub]]/route-[slug].vue` },
    ],
    output: [
      {
        path: '/:foo?',
        file: `${pagesDir}/[[foo]]`,
        children: [{ name: 'foo', path: '', file: `${pagesDir}/[[foo]]/index.vue` }],
      },
      { name: 'index', path: '/', file: `${pagesDir}/index.vue` },
      { name: 'slug', path: '/:slug()', file: `${pagesDir}/[slug].vue` },
      { name: 'bar', path: '/:bar()', file: `${pagesDir}/[bar]/index.vue` },
      { name: 'opt-slug', path: '/opt/:slug?', file: `${pagesDir}/opt/[[slug]].vue` },
      { name: 'nonopt-slug', path: '/nonopt/:slug()', file: `${pagesDir}/nonopt/[slug].vue` },
      { name: 'optional-opt', path: '/optional/:opt?', file: `${pagesDir}/optional/[[opt]].vue` },
      { name: 'sub-route-slug', path: '/:sub?/route-:slug()', file: `${pagesDir}/[[sub]]/route-[slug].vue` },
      { name: 'optional-prefix-opt', path: '/optional/prefix-:opt?', file: `${pagesDir}/optional/prefix-[[opt]].vue` },
      { name: 'optional-opt-postfix', path: '/optional/:opt?-postfix', file: `${pagesDir}/optional/[[opt]]-postfix.vue` },
      { name: 'optional-prefix-opt-postfix', path: '/optional/prefix-:opt?-postfix', file: `${pagesDir}/optional/prefix-[[opt]]-postfix.vue` },
    ],
  },
  {
    description: 'should generate correct catch-all route',
    files: [{ path: `${pagesDir}/[...slug].vue` }, { path: `${pagesDir}/index.vue` }, { path: `${pagesDir}/[...slug]/[id].vue` }],
    output: [
      { name: 'index', path: '/', file: `${pagesDir}/index.vue` },
      {
        name: 'slug',
        path: '/:slug(.*)*',
        file: `${pagesDir}/[...slug].vue`,
        children: [{ name: 'slug-id', path: ':id()', file: `${pagesDir}/[...slug]/[id].vue` }],
      },
    ],
  },
  {
    description: 'should throw unfinished param error for dynamic route',
    files: [{ path: `${pagesDir}/[slug.vue` }],
    error: 'Unfinished param "slug"',
  },
  {
    description: 'should throw empty param error for dynamic route',
    files: [{ path: `${pagesDir}/[].vue` }],
    error: 'Empty param',
  },
  {
    description: 'should only allow "_" & "." as special character for dynamic route',
    files: [
      { path: `${pagesDir}/[a1_1a].vue` },
      { path: `${pagesDir}/[b2.2b].vue` },
      { path: `${pagesDir}/[b2]_[2b].vue` },
      { path: `${pagesDir}/[[c3@3c]].vue` },
      { path: `${pagesDir}/[[d4-4d]].vue` },
    ],
    output: [
      { name: 'a1_1a', path: '/:a1_1a()', file: `${pagesDir}/[a1_1a].vue` },
      { name: 'b2.2b', path: '/:b2.2b()', file: `${pagesDir}/[b2.2b].vue` },
      { name: 'b2_2b', path: '/:b2()_:2b()', file: `${pagesDir}/[b2]_[2b].vue` },
      { name: 'c33c', path: '/:c33c?', file: `${pagesDir}/[[c3@3c]].vue` },
      { name: 'd44d', path: '/:d44d?', file: `${pagesDir}/[[d4-4d]].vue` },
    ],
  },
  {
    description: 'should properly override route name if definePageMeta name override is defined.',
    files: [{ path: `${pagesDir}/index.vue`, template: `<script setup lang="ts">definePageMeta({ name: 'home' })</script>` }],
    output: [{ name: 'home', path: '/', file: `${pagesDir}/index.vue` }],
  },
  {
    description: 'should allow pages with `:` in their path',
    files: [{ path: `${pagesDir}/test:name.vue` }],
    output: [{ name: 'test:name', path: '/test\\:name', file: `${pagesDir}/test:name.vue` }],
  },
  {
    description: 'should handle unicode and special characters in page paths',
    files: [
      { path: `${pagesDir}/测试.vue` },
      { path: `${pagesDir}/文档.vue` },
      { path: `${pagesDir}/文档/介绍.vue` },
      { path: `${pagesDir}/خاص:جديد.vue` },
    ],
    output: [
      { name: '测试', path: `/${encodeURIComponent('测试')}`, file: `${pagesDir}/测试.vue` },
      { name: '文档', path: `/${encodeURIComponent('文档')}`, file: `${pagesDir}/文档.vue`, children: [
        { name: '文档-介绍', path: encodeURIComponent('介绍'), file: `${pagesDir}/文档/介绍.vue` },
      ] },
      { name: 'خاص:جديد', path: `/${encodeURIComponent('خاص')}\\:${encodeURIComponent('جديد')}`, file: `${pagesDir}/خاص:جديد.vue` },
    ],
  },
  {
    description: 'should escape special chars in static paths',
    files: [
      { path: `${pagesDir}/a&b.vue` },
      { path: `${pagesDir}/a\\b.vue` },
    ],
    output: [
      { name: 'a&b', path: '/a&b', file: `${pagesDir}/a&b.vue` },
      { name: 'a\\b', path: `/a${encodeURIComponent('\\')}b`, file: `${pagesDir}/a\\b.vue` },
    ],
  },
  {
    description: 'should not merge required param as a child of optional param',
    files: [
      { path: `${pagesDir}/[[foo]].vue` },
      { path: `${pagesDir}/[foo].vue` },
    ],
    output: [
      { name: 'foo', path: '/:foo()', file: `${pagesDir}/[foo].vue` },
      { name: 'foo', path: '/:foo?', file: `${pagesDir}/[[foo]].vue` },
    ],
  },
  {
    description: 'should correctly merge nested routes',
    files: [
      { path: `${pagesDir}/param.vue` },
      { path: `${layerDir}/param/index.vue` },
      { path: `${pagesDir}/param/index/index.vue` },
      { path: `${layerDir}/param/index/sibling.vue` },
      { path: `${pagesDir}/wrapper-expose/other.vue` },
      { path: `${layerDir}/wrapper-expose/other/index.vue` },
      { path: `${pagesDir}/wrapper-expose/other/sibling.vue` },
      { path: `${pagesDir}/param/sibling.vue` },
    ],
    output: [
      {
        path: '/param',
        file: `${pagesDir}/param.vue`,
        children: [
          {
            path: '',
            file: `${layerDir}/param/index.vue`,
            children: [
              { name: 'param-index', path: '', file: `${pagesDir}/param/index/index.vue` },
              { name: 'param-index-sibling', path: 'sibling', file: `${layerDir}/param/index/sibling.vue` },
            ],
          },
          { name: 'param-sibling', path: 'sibling', file: `${pagesDir}/param/sibling.vue` },
        ],
      },
      {
        path: '/wrapper-expose/other',
        file: `${pagesDir}/wrapper-expose/other.vue`,
        children: [
          { name: 'wrapper-expose-other', path: '', file: `${layerDir}/wrapper-expose/other/index.vue` },
          { name: 'wrapper-expose-other-sibling', path: 'sibling', file: `${pagesDir}/wrapper-expose/other/sibling.vue` },
        ],
      },
    ],
  },
  {
    description: 'should handle trailing slashes with index routes',
    files: [
      { path: `${pagesDir}/index/index.vue` },
      { path: `${pagesDir}/index/index/all.vue` },
    ],
    output: [
      {
        name: 'index',
        path: '/',
        file: `${pagesDir}/index/index.vue`,
        children: [{ name: 'index-index-all', path: 'all', file: `${pagesDir}/index/index/all.vue` }],
      },
    ],
  },
  {
    description: 'should generate correct routes for nested pages',
    files: [
      { path: `${pagesDir}/page1/index.vue` },
      { path: `${pagesDir}/page1/[id].vue` },
      { path: `${pagesDir}/page1.vue` },
    ],
    output: [
      {
        path: '/page1',
        file: `${pagesDir}/page1.vue`,
        children: [
          { name: 'page1-id', path: ':id()', file: `${pagesDir}/page1/[id].vue` },
          { name: 'page1', path: '', file: `${pagesDir}/page1/index.vue` },
        ],
      },
    ],
  },
  {
    description: 'should use fallbacks when normalized with `overrideMeta: true`',
    files: [
      {
        path: `${pagesDir}/index.vue`,
        template: `
            <script setup lang="ts">
            const routeName = ref('home')
            const routeAliases = ref(['sweet-home'])
            definePageMeta({
              name: routeName.value,
              alias: routeAliases.value,
              hello: 'world',
              redirect: () => '/'
            })
            </script>
          `,
      },
    ],
    output: [{ name: 'index', path: '/', file: `${pagesDir}/index.vue`, dynamic: ['name', 'alias', 'redirect', 'meta'] }],
  },
  {
    description: 'should extract serializable values and override fallback when normalized with `overrideMeta: true`',
    files: [
      {
        path: `${pagesDir}/index.vue`,
        template: `<script setup lang="ts">definePageMeta({ name: 'home', alias: ['sweet-home'], redirect: '/', hello: 'world' })</script>`,
      },
    ],
    output: [{ name: 'home', path: '/', file: `${pagesDir}/index.vue`, alias: ['sweet-home'], redirect: '/', dynamic: ['meta'] }],
  },
  {
    description: 'should handle unicode characters in alias paths',
    files: [
      {
        path: `${pagesDir}/products.vue`,
        template: `<script setup lang="ts">definePageMeta({ alias: ['/товары', '/produits', '/製品'] })</script>`,
      },
    ],
    output: [{ name: 'products', path: '/products', file: `${pagesDir}/products.vue`, alias: ['/товары', '/produits', '/製品'] }],
  },
  {
    description: 'route without file',
    output: [{ name: 'home', path: '/', alias: ['sweet-home'], meta: { hello: 'world' } }],
  },
  {
    description: 'pushed route, skips generation from file',
    output: [{ name: 'pushed-route', path: '/', alias: ['pushed-route-alias'], meta: { someMetaData: true }, file: `${pagesDir}/route-file.vue` }],
  },
  {
    description: 'route.meta generated from file',
    files: [{ path: `${pagesDir}/page-with-meta.vue`, meta: { test: 1 } }],
    output: [{ name: 'page-with-meta', path: '/page-with-meta', file: `${pagesDir}/page-with-meta.vue`, meta: { test: 1 } }],
  },
  {
    description: 'should use more performant regexp when catchall is used in middle of path',
    files: [
      { path: `${pagesDir}/[...id]/suffix.vue` },
      { path: `${pagesDir}/[...id]/index.vue` },
    ],
    output: [
      { name: 'id', path: '/:id(.*)*', file: `${pagesDir}/[...id]/index.vue` },
      { name: 'id-suffix', path: '/:id([^/]*)*/suffix', file: `${pagesDir}/[...id]/suffix.vue` },
    ],
  },
  {
    description: 'should merge route.meta with meta from file',
    files: [
      {
        path: `${pagesDir}/page-with-meta.vue`,
        meta: { test: 1, extracted: { foo: 'foo' } },
        template: `<script setup lang="ts">definePageMeta({ hello: 'world', extracted: { bar: 'bar' } })</script>`,
      },
    ],
    output: [
      {
        name: 'page-with-meta',
        path: '/page-with-meta',
        file: `${pagesDir}/page-with-meta.vue`,
        meta: { test: 1, extracted: { foo: 'foo', bar: 'bar' } },
        dynamic: ['meta'],
      },
    ],
  },
  {
    description: 'route.meta props generate by file',
    files: [{ path: `${pagesDir}/page-with-props.vue`, template: `<script setup lang="ts">definePageMeta({ props: true })</script>` }],
    output: [{ name: 'page-with-props', path: '/page-with-props', file: `${pagesDir}/page-with-props.vue`, props: true }],
  },
  {
    description: 'should handle route groups',
    files: [
      { path: `${pagesDir}/(foo)/index.vue` },
      { path: `${pagesDir}/(foo)/about.vue` },
      { path: `${pagesDir}/(bar)/about/index.vue` },
      { path: `${pagesDir}/(bar)/about/(foo)/index.vue` },
    ],
    output: [
      { name: 'index', path: '/', file: `${pagesDir}/(foo)/index.vue`, meta: { groups: ['foo'] } },
      {
        path: '/about',
        file: `${pagesDir}/(foo)/about.vue`,
        meta: { groups: ['foo'] },
        children: [
          {
            path: '',
            file: `${pagesDir}/(bar)/about/index.vue`,
            meta: { groups: ['bar'] },
            children: [{ name: 'about', path: '', file: `${pagesDir}/(bar)/about/(foo)/index.vue`, meta: { groups: ['bar', 'foo'] } }],
          },
        ],
      },
    ],
  },
  {
    description: 'should preserve named views from the `name@view.vue` filename convention',
    files: [
      { path: `${pagesDir}/foo.vue` },
      { path: `${pagesDir}/foo/bar.vue` },
      { path: `${pagesDir}/foo/bar@left.vue` },
    ],
    output: [
      {
        name: 'foo',
        path: '/foo',
        file: `${pagesDir}/foo.vue`,
        children: [
          {
            name: 'foo-bar',
            path: 'bar',
            file: `${pagesDir}/foo/bar.vue`,
            components: { default: `${pagesDir}/foo/bar.vue`, left: `${pagesDir}/foo/bar@left.vue` },
          },
        ],
      },
    ],
  },
]
