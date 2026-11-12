import { routeToRegExp } from 'rou3'
import { describe, expect, it } from 'vitest'

import type { NuxtPage } from 'nuxt/schema'
import { collectRou3PagePatterns, collectRou3PageSources, toRou3Patterns, toRou3RoutePatterns } from '../src/pages/route-patterns.ts'
import { getRouterOptionsKeys, routerOptionsMayModifyRoutes } from '../src/pages/router-options.ts'

describe('toRou3Patterns', () => {
  it.each([
    ['/', '/'],
    ['/parent/:child()', '/parent/:child'],
    ['/parent-:child()', '/parent-:child'],
    ['/:stories(.*)*', '/**:stories'],
    ['/:foo?', '/:foo'],
    ['/:sub?/route-:slug()', '/:sub/route-:slug'],
    ['/optional/prefix-:opt?', '/optional/prefix-:opt'],
    ['/optional/:opt?-postfix', '/optional/:opt_postfix'],
    ['/:id([^/]*)*/suffix', '/**:id'],
    ['/:b2.2b()', '/:b2_2b'],
    ['/:b2()_:2b()', '/:b2__2b'],
    ['/test\\:name', '/test\\:name'],
    ['/a%5Cb', '/a%5Cb'],
    ['/%E6%B5%8B%E8%AF%95', '/%E6%B5%8B%E8%AF%95'],
  ])('should convert %s to %s', (path, pattern) => {
    expect(toRou3Patterns([{ path }])).toStrictEqual([pattern])
  })

  it('should join nested routes onto their parent pattern', () => {
    const pages: NuxtPage[] = [
      { path: '/parent', children: [{ path: 'child' }, { path: '' }] },
      { path: '/:slug(.*)*', children: [{ path: ':id()' }] },
    ]
    expect(toRou3Patterns(pages)).toStrictEqual(['/parent', '/parent/child', '/parent', '/**:slug', '/**:slug/:id'])
  })
})

describe('toRou3RoutePatterns', () => {
  it.each([
    ['/', '/', ['/'], ['/a']],
    ['/parent/:child()', '/parent/:child', ['/parent/a'], ['/parent', '/parent/a/b']],
    ['/x/:id?', '/x/:id?', ['/x', '/x/a'], ['/x/a/b']],
    ['/:sub?/route-:slug()', '/:sub?/route-:slug', ['/route-a', '/a/route-b'], ['/a/b/route-c']],
    ['/optional/prefix-:opt?', '/optional/prefix-{:opt}?', ['/optional/prefix-', '/optional/prefix-a'], ['/optional/prefix-a/b']],
    ['/:slug(.*)*', '/:slug(.*)', ['/', '/a', '/a/b/c'], []],
    ['/docs/:slug(.*)*', '/docs/:slug(.*)', ['/docs', '/docs/a/b'], ['/other']],
    ['/:id([^/]*)*/suffix', '/:id(.*)/suffix', ['/a/suffix', '/a/b/suffix'], ['/a']],
    ['/:locale(de|fr)/account', '/:locale(de|fr)/account', ['/de/account'], ['/en/account']],
    [
      '/package-code/:org?/:name/v/:version/:filePath(.*)?',
      '/package-code/:org?/:name/v/:version/:filePath(.*)',
      ['/package-code/vue/v/3', '/package-code/vue/v/3/src/index.ts', '/package-code/nuxt/kit/v/4/dist/index.mjs'],
      ['/package-code/vue', '/package-code/a/b/c/v/3'],
    ],
  ])('should convert %s to %s', (path, pattern, matches, mismatches) => {
    expect(toRou3RoutePatterns([{ path }])).toStrictEqual([pattern])
    const re = routeToRegExp(pattern)
    for (const url of matches) { expect(url).toMatch(re) }
    for (const url of mismatches) { expect(url).not.toMatch(re) }
  })

  it('should resolve nested routes against the parent path before converting', () => {
    const pages: NuxtPage[] = [
      { path: '/parent', children: [{ path: 'child' }, { path: '' }, { path: '/absolute' }] },
      { path: '/:org?/:name()', children: [{ path: ':file(.*)?' }] },
      { path: '/:slug(.*)*', children: [{ path: ':id()' }] },
    ]
    expect(toRou3RoutePatterns(pages)).toStrictEqual([
      '/parent',
      '/parent/child',
      '/parent',
      '/absolute',
      '/:org?/:name',
      '/:org?/:name/:file(.*)',
      '/:slug(.*)',
      '/:slug(.*)/:id',
    ])
  })
})

describe('collectRou3PagePatterns', () => {
  it('should collect patterns for static and dynamic pages', () => {
    const pages: NuxtPage[] = [
      { name: 'index', path: '/' },
      { name: 'about', path: '/about' },
      { name: 'product', path: '/products/:id()' },
      { name: 'catchall', path: '/:slug(.*)*' },
    ]
    expect(collectRou3PagePatterns(pages)).toMatchInlineSnapshot(`
      [
        "/",
        "/about",
        "/products/:_0",
        "/**",
      ]
    `)
  })

  it('should nest children (and their aliases) under every parent path and alias', () => {
    const pages: NuxtPage[] = [
      {
        name: 'parent',
        path: '/parent',
        alias: ['/p'],
        children: [
          { name: 'child', path: 'child', alias: ['kid'] },
          { name: 'absolute', path: '/elsewhere' },
          { name: 'deep', path: 'deep', children: [{ name: 'leaf', path: 'leaf' }] },
        ],
      },
    ]
    expect(collectRou3PagePatterns(pages)).toMatchInlineSnapshot(`
      [
        "/parent",
        "/p",
        "/parent/child",
        "/p/child",
        "/parent/kid",
        "/p/kid",
        "/elsewhere",
        "/parent/deep",
        "/p/deep",
        "/parent/deep/leaf",
        "/p/deep/leaf",
      ]
    `)
  })

  it('should collapse optional params into multiple patterns', () => {
    const pages: NuxtPage[] = [
      { name: 'optional', path: '/optional/:opt?' },
    ]
    expect(collectRou3PagePatterns(pages)).toMatchInlineSnapshot(`
      [
        "/optional",
        "/optional/:_0",
      ]
    `)
  })

  it('should refuse to convert a path that cannot be decoded', () => {
    const pages: NuxtPage[] = [
      { name: 'index', path: '/' },
      { name: 'odd', path: '/100% legit' },
    ]
    const unconvertible: string[] = []
    expect(collectRou3PagePatterns(pages, ['/'], route => unconvertible.push(route))).toBeUndefined()
    expect(unconvertible).toStrictEqual(['/100% legit'])
  })

  it('should collapse routes it cannot express exactly into broader patterns', () => {
    const pages: NuxtPage[] = [
      { name: 'index', path: '/' },
      { name: 'product', path: '/products/:id(\\d+)/edit' },
      { name: 'parent', path: '/parent', children: [{ name: 'user', path: ':user(.*)*' }] },
    ]
    const unconvertible: string[] = []
    expect(collectRou3PagePatterns(pages, ['/'], route => unconvertible.push(route))).toStrictEqual([
      '/',
      '/products/**',
      '/parent',
      '/parent/**',
    ])
    expect(unconvertible).toStrictEqual([])
  })
})

describe('collectRou3PageSources', () => {
  it('should map every page path to the sources of its matched route records', () => {
    const pages: NuxtPage[] = [
      { name: 'index', path: '/', file: '/app/pages/index.vue' },
      { name: 'product', path: '/products/:id()', alias: ['/p/:id()'], file: '/app/pages/products/[id].vue' },
      {
        path: '/parent',
        file: '/app/pages/parent.vue',
        children: [
          { name: 'parent', path: '', file: '/app/pages/parent/index.vue' },
          { name: 'parent-child', path: 'child', file: '/app/pages/parent/child.vue', components: { sidebar: '/app/components/sidebar.vue' } },
        ],
      },
    ]
    expect(Object.fromEntries(collectRou3PageSources(pages, '/app')!)).toMatchInlineSnapshot(`
      {
        "/": [
          "pages/index.vue",
        ],
        "/p/:_0": [
          "pages/products/[id].vue",
        ],
        "/parent": [
          "pages/parent.vue",
          "pages/parent/index.vue",
        ],
        "/parent/child": [
          "pages/parent.vue",
          "pages/parent/child.vue",
          "components/sidebar.vue",
        ],
        "/products/:_0": [
          "pages/products/[id].vue",
        ],
      }
    `)
  })

  it('should not resolve patterns shared by unrelated pages', () => {
    const pages: NuxtPage[] = [
      { name: 'user', path: '/users/:id()', file: '/app/pages/users/[id].vue' },
      { name: 'member', path: '/users/:name()', file: '/app/pages/users/[name].vue' },
      { name: 'catchall', path: '/:slug(.*)*', file: '/app/pages/[...slug].vue' },
    ]
    expect(Object.fromEntries(collectRou3PageSources(pages, '/app')!)).toEqual({
      '/users/:_0': undefined,
      '/**': ['pages/[...slug].vue'],
    })
  })

  it('should not resolve a pattern shared by a sibling and a nested route that share a file', () => {
    const pages: NuxtPage[] = [
      { name: 'first', path: '/shared', file: '/app/pages/shared.vue' },
      {
        path: '/shared',
        file: '/app/pages/shared.vue',
        children: [{ name: 'second', path: '', file: '/app/pages/shared/index.vue' }],
      },
    ]
    expect(Object.fromEntries(collectRou3PageSources(pages, '/app')!)).toEqual({
      '/shared': undefined,
    })
  })

  it('should bail out when a path is widened', () => {
    const pages: NuxtPage[] = [
      { name: 'numeric', path: '/users/:id(\\d+)', file: '/app/pages/users/numeric.vue' },
      { name: 'named', path: '/users/:name()', file: '/app/pages/users/named.vue' },
    ]
    expect(collectRou3PageSources(pages, '/app')).toBeUndefined()
  })

  it.each(['/foo/%2A', '/foo/%28bar%29', '/foo/%7Bbar%7D'])('should bail out when %s decodes to route syntax', (path) => {
    const pages: NuxtPage[] = [
      { name: 'encoded', path, file: '/app/pages/encoded.vue' },
      { name: 'catchall', path: '/:slug(.*)*', file: '/app/pages/[...slug].vue' },
    ]
    expect(collectRou3PageSources(pages, '/app')).toBeUndefined()
  })
})

describe('getRouterOptionsKeys', () => {
  it('should list the keys of an object literal default export', () => {
    expect(getRouterOptionsKeys('export default <RouterConfig> { sensitive: true, "strict": false }', 'router.options.ts')).toEqual(new Set(['sensitive', 'strict']))
    expect(getRouterOptionsKeys(`export default { ['sensitive']: true }`, 'router.options.ts')).toEqual(new Set(['sensitive']))
    expect(getRouterOptionsKeys('export default { [key]: true }', 'router.options.ts')).toBeUndefined()
    expect(getRouterOptionsKeys('export default { ...shared, sensitive: true }', 'router.options.ts')).toBeUndefined()
    expect(getRouterOptionsKeys('export default defineRouterOptions({ sensitive: true })', 'router.options.ts')).toBeUndefined()
  })
})

describe('routerOptionsMayModifyRoutes', () => {
  const check = (code: string) => routerOptionsMayModifyRoutes(code, 'router.options.ts')

  it('should allow object literals without a routes key', () => {
    expect(check('export default { scrollBehavior () { return { top: 0 } } }')).toBe(false)
    expect(check('export default <RouterConfig> { sensitive: true }')).toBe(false)
    expect(check('export default { hashMode: false } satisfies RouterConfig')).toBe(false)
    expect(check('const top = 0\nexport default { scrollBehavior: () => ({ top }) } as RouterConfig')).toBe(false)
  })

  it('should detect a routes key', () => {
    expect(check('export default { routes: routes => routes }')).toBe(true)
    expect(check('export default { "routes": r => r }')).toBe(true)
    expect(check('export default <RouterConfig> { routes: (r) => r.filter(Boolean) }')).toBe(true)
  })

  it('should be conservative when the export cannot be analysed', () => {
    expect(check('const options = { sensitive: true }\nexport default options')).toBe(true)
    expect(check('export default { ...shared }')).toBe(true)
    expect(check('export default { [key]: value }')).toBe(true)
    expect(check('export default defineRouterOptions({})')).toBe(true)
    expect(check('not valid { syntax')).toBe(true)
    expect(check('export const routes = []')).toBe(true)
  })
})
