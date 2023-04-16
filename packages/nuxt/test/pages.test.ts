import { describe, expect, it } from 'vitest'
import { generateRoutesFromFiles } from '../src/pages/utils'
import { generateRouteKey } from '../src/pages/runtime/utils'

describe('pages:generateRoutesFromFiles', () => {
  const pagesDir = 'pages'
  const tests = [
    {
      description: 'should generate correct routes for index pages',
      files: [
        `${pagesDir}/index.vue`,
        `${pagesDir}/parent/index.vue`,
        `${pagesDir}/parent/child/index.vue`
      ],
      output: [
        {
          name: 'index',
          path: '/',
          file: `${pagesDir}/index.vue`,
          children: []
        },
        {
          name: 'parent',
          path: '/parent',
          file: `${pagesDir}/parent/index.vue`,
          children: []
        },
        {
          name: 'parent-child',
          path: '/parent/child',
          file: `${pagesDir}/parent/child/index.vue`,
          children: []
        }
      ]
    },
    {
      description: 'should generate correct routes for parent/child',
      files: [
        `${pagesDir}/parent.vue`,
        `${pagesDir}/parent/child.vue`
      ],
      output: [
        {
          name: 'parent',
          path: '/parent',
          file: `${pagesDir}/parent.vue`,
          children: [
            {
              name: 'parent-child',
              path: 'child',
              file: `${pagesDir}/parent/child.vue`,
              children: []
            }
          ]
        }
      ]
    },
    {
      description: 'should not generate colliding route names when hyphens are in file name',
      files: [
        `${pagesDir}/parent/[child].vue`,
        `${pagesDir}/parent-[child].vue`
      ],
      output: [
        {
          name: 'parent-child',
          path: '/parent/:child()',
          file: `${pagesDir}/parent/[child].vue`,
          children: []
        },
        {
          name: 'parent-child',
          path: '/parent-:child()',
          file: `${pagesDir}/parent-[child].vue`,
          children: []
        }
      ]
    },
    {
      description: 'should generate correct id for catchall (order 1)',
      files: [
        `${pagesDir}/[...stories].vue`,
        `${pagesDir}/stories/[id].vue`
      ],
      output: [
        {
          name: 'stories',
          path: '/:stories(.*)*',
          file: `${pagesDir}/[...stories].vue`,
          children: []
        },
        {
          name: 'stories-id',
          path: '/stories/:id()',
          file: `${pagesDir}/stories/[id].vue`,
          children: []
        }
      ]
    },
    {
      description: 'should generate correct id for catchall (order 2)',
      files: [
        `${pagesDir}/stories/[id].vue`,
        `${pagesDir}/[...stories].vue`
      ],
      output: [
        {
          name: 'stories-id',
          path: '/stories/:id()',
          file: `${pagesDir}/stories/[id].vue`,
          children: []
        },
        {
          name: 'stories',
          path: '/:stories(.*)*',
          file: `${pagesDir}/[...stories].vue`,
          children: []
        }
      ]
    },
    {
      description: 'should generate correct route for snake_case file',
      files: [
        `${pagesDir}/snake_case.vue`
      ],
      output: [
        {
          name: 'snake_case',
          path: '/snake_case',
          file: `${pagesDir}/snake_case.vue`,
          children: []
        }
      ]
    },
    {
      description: 'should generate correct route for kebab-case file',
      files: [`${pagesDir}/kebab-case.vue`],
      output: [
        {
          name: 'kebab-case',
          path: '/kebab-case',
          file: `${pagesDir}/kebab-case.vue`,
          children: []
        }
      ]
    },
    {
      description: 'should generate correct dynamic routes',
      files: [
        `${pagesDir}/index.vue`,
        `${pagesDir}/[slug].vue`,
        `${pagesDir}/[[foo]]`,
        `${pagesDir}/[[foo]]/index.vue`,
        `${pagesDir}/[bar]/index.vue`,
        `${pagesDir}/nonopt/[slug].vue`,
        `${pagesDir}/opt/[[slug]].vue`,
        `${pagesDir}/[[sub]]/route-[slug].vue`
      ],
      output: [
        {
          name: 'index',
          path: '/',
          file: `${pagesDir}/index.vue`,
          children: []
        },
        {
          children: [],
          name: 'slug',
          file: 'pages/[slug].vue',
          path: '/:slug()'
        },
        {
          children: [
            {

              name: 'foo',
              path: '',
              file: `${pagesDir}/[[foo]]/index.vue`,
              children: []
            }
          ],
          file: 'pages/[[foo]]',
          path: '/:foo?'
        },
        {
          children: [],
          name: 'bar',
          file: 'pages/[bar]/index.vue',
          path: '/:bar()'
        },
        {
          name: 'nonopt-slug',
          path: '/nonopt/:slug()',
          file: `${pagesDir}/nonopt/[slug].vue`,
          children: []
        },
        {
          name: 'opt-slug',
          path: '/opt/:slug?',
          file: `${pagesDir}/opt/[[slug]].vue`,
          children: []
        },
        {
          name: 'sub-route-slug',
          path: '/:sub?/route-:slug()',
          file: `${pagesDir}/[[sub]]/route-[slug].vue`,
          children: []
        }
      ]
    },
    {
      description: 'should generate correct catch-all route',
      files: [`${pagesDir}/[...slug].vue`, `${pagesDir}/index.vue`],
      output: [
        {
          name: 'slug',
          path: '/:slug(.*)*',
          file: `${pagesDir}/[...slug].vue`,
          children: []
        },
        {
          name: 'index',
          path: '/',
          file: `${pagesDir}/index.vue`,
          children: []
        }
      ]
    },
    {
      description: 'should throw unfinished param error for dynamic route',
      files: [`${pagesDir}/[slug.vue`],
      error: 'Unfinished param "slug"'
    },
    {
      description: 'should throw empty param error for dynamic route',
      files: [
        `${pagesDir}/[].vue`
      ],
      error: 'Empty param'
    },
    {
      description: 'should only allow "_" & "." as special character for dynamic route',
      files: [
        `${pagesDir}/[a1_1a].vue`,
        `${pagesDir}/[b2.2b].vue`,
        `${pagesDir}/[b2]_[2b].vue`,
        `${pagesDir}/[[c3@3c]].vue`,
        `${pagesDir}/[[d4-4d]].vue`
      ],
      output: [
        {
          name: 'a1_1a',
          path: '/:a1_1a()',
          file: `${pagesDir}/[a1_1a].vue`,
          children: []
        },
        {
          name: 'b2.2b',
          path: '/:b2.2b()',
          file: `${pagesDir}/[b2.2b].vue`,
          children: []
        },
        {
          name: 'b2_2b',
          path: '/:b2()_:2b()',
          file: `${pagesDir}/[b2]_[2b].vue`,
          children: []
        },
        {
          name: 'c33c',
          path: '/:c33c?',
          file: `${pagesDir}/[[c3@3c]].vue`,
          children: []
        },
        {
          name: 'd44d',
          path: '/:d44d?',
          file: `${pagesDir}/[[d4-4d]].vue`,
          children: []
        }
      ]
    }
  ]

  for (const test of tests) {
    it(test.description, async () => {
      if (test.error) {
        expect(() => generateRoutesFromFiles(test.files, pagesDir)).to.throws(test.error)
      } else {
        expect(await generateRoutesFromFiles(test.files, pagesDir)).to.deep.equal(test.output)
      }
    })
  }
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
        array: ['a', 'b']
      },
      matched: [
        {
          components: { default: {} },
          meta: { key: 'other-meta-key' }
        },
        {
          components: { default: defaultComponent.type },
          meta: { key: 'matched-meta-key' },
          ...matchedRoute
        }
      ]
    }
  }) as any

  const tests = [
    { description: 'should handle overrides', override: 'key', route: getRouteProps(), output: 'key' },
    { description: 'should handle overrides', override: (route: any) => route.meta.key as string, route: getRouteProps(), output: 'route-meta-key' },
    { description: 'should handle overrides', override: false as any, route: getRouteProps(), output: false },
    {
      description: 'should key dynamic routes without keys',
      route: getRouteProps({
        path: '/test/:id',
        meta: {}
      }),
      output: '/test/foo'
    },
    {
      description: 'should key dynamic routes without keys',
      route: getRouteProps({
        path: '/test/:id(\\d+)',
        meta: {}
      }),
      output: '/test/foo'
    },
    {
      description: 'should key dynamic routes with optional params',
      route: getRouteProps({
        path: '/test/:optional?',
        meta: {}
      }),
      output: '/test/bar'
    },
    {
      description: 'should key dynamic routes with optional params',
      route: getRouteProps({
        path: '/test/:optional(\\d+)?',
        meta: {}
      }),
      output: '/test/bar'
    },
    {
      description: 'should key dynamic routes with optional params',
      route: getRouteProps({
        path: '/test/:undefined(\\d+)?',
        meta: {}
      }),
      output: '/test/'
    },
    {
      description: 'should key dynamic routes with array params',
      route: getRouteProps({
        path: '/:array+',
        meta: {}
      }),
      output: '/a,b'
    },
    {
      description: 'should key dynamic routes with array params',
      route: getRouteProps({
        path: '/test/:array*',
        meta: {}
      }),
      output: '/test/a,b'
    },
    {
      description: 'should key dynamic routes with array params',
      route: getRouteProps({
        path: '/test/:other*',
        meta: {}
      }),
      output: '/test/'
    }
  ]

  for (const test of tests) {
    it(test.description, () => {
      expect(generateRouteKey(test.route, test.override)).to.deep.equal(test.output)
    })
  }
})
