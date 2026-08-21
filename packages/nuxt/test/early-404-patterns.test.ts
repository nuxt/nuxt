import { describe, expect, it } from 'vitest'

import type { NuxtPage } from 'nuxt/schema'
import { collectRou3PagePatterns, routerOptionsMayModifyRoutes } from '../src/pages/utils.ts'

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
        "/products/*",
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
        "/optional/*",
      ]
    `)
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
