import { describe, expect, it } from 'vitest'
import { collectStaticPageRoutes, getAssetPathsForRoute } from '../src/pages/public-assets.ts'
import type { NuxtPage } from 'nuxt/schema'

describe('collectStaticPageRoutes', () => {
  it('collects top-level and nested routes', () => {
    const pages: NuxtPage[] = [
      { path: '/', file: 'pages/index.vue' },
      {
        path: '/docs',
        file: 'pages/docs.vue',
        children: [
          { path: 'getting-started', file: 'pages/docs/getting-started.vue' },
        ],
      },
    ]

    expect([...collectStaticPageRoutes(pages)]).toMatchInlineSnapshot(`
      [
        [
          "/",
          "pages/index.vue",
        ],
        [
          "/docs",
          "pages/docs.vue",
        ],
        [
          "/docs/getting-started",
          "pages/docs/getting-started.vue",
        ],
      ]
    `)
  })

  it('skips dynamic and catch-all routes', () => {
    const pages: NuxtPage[] = [
      { path: '/:slug', file: 'pages/[slug].vue' },
      { path: '/:slug(.*)*', file: 'pages/[...slug].vue' },
      { path: '/about', file: 'pages/about.vue' },
    ]

    expect([...collectStaticPageRoutes(pages).keys()]).toStrictEqual(['/about'])
  })

  it('collects static aliases', () => {
    const pages: NuxtPage[] = [
      { path: '/about', file: 'pages/about.vue', alias: ['/about-us', '/:legacy'] },
      { path: '/docs', file: 'pages/docs.vue', children: [{ path: 'intro', file: 'pages/docs/intro.vue', alias: 'start' }] },
    ]

    expect([...collectStaticPageRoutes(pages).keys()]).toStrictEqual([
      '/about',
      '/about-us',
      '/docs',
      '/docs/intro',
      '/docs/start',
    ])
  })
})

describe('getAssetPathsForRoute', () => {
  it.each([
    ['/', '/', ['index.html']],
    ['/docs', '/', ['docs', 'docs/index.html']],
    ['/docs/intro', '/', ['docs/intro', 'docs/intro/index.html']],
    ['/about.html', '/', ['about.html', 'about.html/index.html']],
    // routes are only shadowed by assets served under their own base URL
    ['/nested', '/nested', ['index.html']],
    ['/nested/docs', '/nested', ['docs', 'docs/index.html']],
    ['/other', '/nested', undefined],
    ['/nested-sibling', '/nested', undefined],
  ])('resolves %s (base %s)', (route, baseURL, expected) => {
    expect(getAssetPathsForRoute(route, baseURL)).toStrictEqual(expected)
  })
})
