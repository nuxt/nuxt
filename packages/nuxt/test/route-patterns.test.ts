import { describe, expect, it } from 'vitest'

import type { NuxtPage } from 'nuxt/schema'
import { collectRou3PagePatterns, collectRou3PageSources, toRou3Patterns, toRou3RoutePatterns } from '../src/pages/route-patterns.ts'
import { routerOptionsMayDefine } from '../src/pages/router-options.ts'

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
    ['/', '/'],
    ['/parent/:child()', '/parent/:child'],
    ['/:foo?', '/:foo?'],
    ['/:org?/:name()', '/:org?/:name'],
    ['/x/:id?/edit', '/x/:id?/edit'],
    ['/:sub?/route-:slug()', '/:sub?/route-:slug'],
    ['/optional/prefix-:opt?', '/optional/prefix-:opt'],
    ['/optional/:opt?-postfix', '/optional/:opt_postfix'],
    ['/docs/:slug(.*)', '/docs/:slug(.*)'],
    ['/docs/:slug(.*)?', '/docs/:slug(.*)'],
    ['/:slug(.*)?', '/:slug(.*)'],
    ['/:stories(.*)*', '/**:stories'],
    ['/docs/:slug(.*)*', '/docs/**:slug'],
    ['/:id([^/]*)*/suffix', '/**:id'],
    ['/:slug(.*)*/:id?', '/**:slug'],
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
      '/**:slug',
      '/**:slug',
    ])
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

describe('routerOptionsMayDefine', () => {
  const check = (code: string, key: 'routes' | 'sensitive' = 'routes') => routerOptionsMayDefine(code, 'router.options.ts', key)

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

  it('should detect the requested key only', () => {
    expect(check('export default <RouterConfig> { sensitive: true }', 'sensitive')).toBe(true)
    expect(check('export default { "sensitive": false }', 'sensitive')).toBe(true)
    expect(check('export default { routes: r => r }', 'sensitive')).toBe(false)
    expect(check('export default { ...shared }', 'sensitive')).toBe(true)
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
