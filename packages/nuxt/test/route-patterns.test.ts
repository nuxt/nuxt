import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { routeToRegExp } from 'rou3'
import { withoutTrailingSlash } from 'ufo'
import { describe, expect, it } from 'vitest'

import type { NuxtApp, NuxtPage } from 'nuxt/schema'
import { loadNuxt } from '../src/index.ts'
import { collectRou3PagePatterns, collectRou3PageSources, toRou3RoutePatterns } from '../src/pages/route-patterns.ts'
import { getRouterOptionsKeys, routerOptionsMayModifyRoutes } from '../src/pages/router-options.ts'

describe('toRou3RoutePatterns', () => {
  it.each([
    ['/', '/'],
    ['/parent/:child()', '/parent/:child'],
    ['/parent-:child()', '/parent-:child'],
    ['/:b2.2b()', '/:b2.2b\\(\\)'],
    ['/:b2()_:2b()', '/:b2\\_:_2b'],
    ['/test\\:name', '/test\\:name'],
    ['/a%5Cb', '/a%5Cb'],
    ['/%E6%B5%8B%E8%AF%95', '/%E6%B5%8B%E8%AF%95'],
    ['/:foo?', '/:foo?'],
    ['/:org?/:name()', '/:org?/:name'],
    ['/x/:id?/edit', '/x/:id?/edit'],
    ['/:sub?/route-:slug()', '/:sub?/route-:slug'],
    ['/optional/prefix-:opt?', '/optional/prefix-{:opt}?'],
    ['/optional/:opt?-postfix', '/optional/{:opt}?-postfix'],
    ['/docs/:slug(.*)', '/docs/:slug(.*)'],
    ['/docs/:slug(.*)?', '/docs/:slug(.*)'],
    ['/:slug(.*)?', '/:slug(.*)'],
    ['/:stories(.*)*', '/:stories(.*)'],
    ['/docs/:slug(.*)*', '/docs/:slug(.*)'],
    ['/:id([^/]*)*/suffix', '/:id(.*)/suffix'],
    ['/:slug(.*)*/:id?', '/:slug(.*)/:id?'],
    ['/:slug(.*)/edit', '/:slug(.*)/edit'],
    ['/users/:id(\\d+)', '/users/:id'],
    ['/users/:id(\\d+)?', '/users/:id?'],
    ['/:locale(de|fr)/account', '/:locale/account'],
    ['/:locale(en|fr)?/about', '/:locale?/about'],
    ['/files/:id([^/]*)?/raw', '/files/:id?/raw'],
    ['/package-code/:org?/:name()/v/:version()/:filePath(.*)?', '/package-code/:org?/:name/v/:version/:filePath(.*)'],
  ])('should convert %s to %s', (path, pattern) => {
    expect(toRou3RoutePatterns([{ path }])).toStrictEqual([pattern])
  })

  it.each([
    ['/:b2.2b()', ['/a.2b()'], ['/a', '/a.2b']],
    ['/:b2()_:2b()', ['/a_b'], ['/ab']],
    ['/test\\:name', ['/test:name'], ['/test']],
    ['/:org?/:name()', ['/a', '/a/b'], ['/', '/a/b/c']],
    ['/x/:id?/edit', ['/x/edit', '/x/a/edit'], ['/x/a/b/edit']],
    ['/optional/prefix-:opt?', ['/optional/prefix-', '/optional/prefix-a'], ['/optional/prefix-a/b']],
    ['/docs/:slug(.*)?', ['/docs', '/docs/a/b'], ['/other']],
    ['/:stories(.*)*', ['/', '/a', '/a/b/c'], []],
    ['/:id([^/]*)*/suffix', ['/a/suffix', '/a/b/suffix'], ['/a']],
    ['/users/:id(\\d+)', ['/users/1', '/users/a'], ['/users', '/users/1/2']],
    ['/package-code/:org?/:name()/v/:version()/:filePath(.*)?', ['/package-code/vue/v/3', '/package-code/vue/v/3/src/index.ts', '/package-code/nuxt/kit/v/4/dist/index.mjs'], ['/package-code/vue', '/package-code/a/b/c/v/3']],
  ])('should compile the pattern for %s to a rou3 regexp matching its requests', (path, matches, mismatches) => {
    const [pattern] = toRou3RoutePatterns([{ path }])
    const re = routeToRegExp(pattern!)
    for (const url of matches) { expect(url).toMatch(re) }
    for (const url of mismatches) { expect(url).not.toMatch(re) }
  })

  it('should resolve nested routes against the parent path before converting', () => {
    const pages: NuxtPage[] = [
      { path: '/parent', children: [{ path: 'child' }, { path: '' }, { path: '/absolute' }] },
      { path: '/:org?', children: [{ path: ':name()', children: [{ path: ':file(.*)?' }] }] },
      { path: '/:slug(.*)*', children: [{ path: ':id?' }] },
    ]
    expect(toRou3RoutePatterns(pages)).toStrictEqual([
      '/parent',
      '/parent/child',
      '/parent',
      '/absolute',
      '/:org?',
      '/:org?/:name',
      '/:org?/:name/:file(.*)',
      '/:slug(.*)',
      '/:slug(.*)/:id?',
    ])
  })

  it('should emit the same pattern for params that differ only in their regexp', () => {
    const pages: NuxtPage[] = [{ path: '/foo/:id(a|b)' }, { path: '/foo/:id(a-b)' }, { path: '/foo/:id(\\d+)' }]
    expect(new Set(toRou3RoutePatterns(pages))).toStrictEqual(new Set(['/foo/:id']))
  })

  it('should leave out collapsed paths and their children with skipCollapsed', () => {
    const pages: NuxtPage[] = [
      { path: '/:sections+/-/:entries+', children: [{ path: 'child' }] },
      { path: '/docs/:a(.*)*/x/:b(.*)*' },
      { path: '/:slug(.*)*', children: [{ path: ':id?' }] },
    ]
    expect(toRou3RoutePatterns(pages)).toStrictEqual(['/**', '/**', '/docs/**', '/:slug(.*)', '/:slug(.*)/:id?'])
    expect(toRou3RoutePatterns(pages, { skipCollapsed: true })).toStrictEqual(['/:slug(.*)', '/:slug(.*)/:id?'])
  })

  it('should include aliases and nest children under each of them', () => {
    const pages: NuxtPage[] = [
      { path: '/parent', alias: ['/p', '/:org?/p'], children: [{ path: 'kid', alias: ['k', '/abs-kid'] }] },
      { path: '/x', alias: '/y' },
    ]
    expect(toRou3RoutePatterns(pages)).toStrictEqual([
      '/parent',
      '/p',
      '/:org?/p',
      '/parent/kid',
      '/p/kid',
      '/:org?/p/kid',
      '/parent/k',
      '/p/k',
      '/:org?/p/k',
      '/abs-kid',
      '/x',
      '/y',
    ])
  })
})

describe('pages module route patterns', () => {
  it('passes page patterns to Nitro `ssrRoutes` and `_noScriptsPagePatterns`', async () => {
    const nuxt = await loadNuxt({ cwd: withoutTrailingSlash(normalize(fileURLToPath(new URL('./pages-fixture', import.meta.url)))), ready: true })

    try {
      nuxt.apps.default = {
        pages: [
          { path: '/package-code/:org?/:name()/v/:version()/:filePath(.*)?' },
          { path: '/docs/:slug(.*)*' },
          { path: '/files/:id([^/]*)*/raw' },
          { path: '/:sections+/-/:entries+' },
        ],
      } as NuxtApp

      const nitro = (nuxt as any)._nitro
      nitro.options.ssrRoutes = ['/existing']
      await nuxt.callHook('nitro:build:before', nitro)

      expect(nitro.options.ssrRoutes).toStrictEqual([
        '/existing',
        '/package-code/:org?/:name/v/:version/:filePath(.*)',
        '/docs/:slug(.*)',
        '/files/:id(.*)/raw',
        '/**',
      ])
      expect(nitro.options._noScriptsPagePatterns).toStrictEqual([
        '/package-code/:org?/:name/v/:version/:filePath(.*)',
        '/docs/:slug(.*)',
        '/files/:id(.*)/raw',
      ])
    } finally {
      await nuxt.close()
    }
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
