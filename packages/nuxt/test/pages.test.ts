import { describe, expect, it } from 'vitest'
import type { NuxtPage } from 'nuxt/schema'
import { generateRoutesFromFiles, pathToNitroGlob } from '../src/pages/utils'
import { generateRouteKey } from '../src/pages/runtime/utils'

describe('pages:generateRoutesFromFiles', () => {
  const pagesDir = 'pages'
  const tests: Array<{
    description: string
    files: Array<{ path: string; template?: string; }>
    output?: NuxtPage[]
    error?: string
  }> = [
    {
      description: 'should generate correct routes for index pages',
      files: [
        { path: `${pagesDir}/index.vue` },
        { path: `${pagesDir}/parent/index.vue` },
        { path: `${pagesDir}/parent/child/index.vue` }
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
        { path: `${pagesDir}/parent.vue` },
        { path: `${pagesDir}/parent/child.vue` }
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
        { path: `${pagesDir}/parent/[child].vue` },
        { path: `${pagesDir}/parent-[child].vue` }
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
        { path: `${pagesDir}/[...stories].vue` },
        { path: `${pagesDir}/stories/[id].vue` }
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
        { path: `${pagesDir}/stories/[id].vue` },
        { path: `${pagesDir}/[...stories].vue` }
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
        { path: `${pagesDir}/snake_case.vue` }
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
      files: [{ path: `${pagesDir}/kebab-case.vue` }],
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
        { path: `${pagesDir}/[[sub]]/route-[slug].vue` }
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
          path: '/optional/:opt?',
          name: 'optional-opt',
          file: `${pagesDir}/optional/[[opt]].vue`
        },
        {
          children: [],
          path: '/optional/prefix-:opt?',
          name: 'optional-prefix-opt',
          file: `${pagesDir}/optional/prefix-[[opt]].vue`
        },

        {
          children: [],
          path: '/optional/:opt?-postfix',
          name: 'optional-opt-postfix',
          file: `${pagesDir}/optional/[[opt]]-postfix.vue`
        },
        {
          children: [],
          path: '/optional/prefix-:opt?-postfix',
          name: 'optional-prefix-opt-postfix',
          file: `${pagesDir}/optional/prefix-[[opt]]-postfix.vue`
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
      files: [{ path: `${pagesDir}/[...slug].vue` }, { path: `${pagesDir}/index.vue` }],
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
      files: [{ path: `${pagesDir}/[slug.vue` }],
      error: 'Unfinished param "slug"'
    },
    {
      description: 'should throw empty param error for dynamic route',
      files: [
        { path: `${pagesDir}/[].vue` }
      ],
      error: 'Empty param'
    },
    {
      description: 'should only allow "_" & "." as special character for dynamic route',
      files: [
        { path: `${pagesDir}/[a1_1a].vue` },
        { path: `${pagesDir}/[b2.2b].vue` },
        { path: `${pagesDir}/[b2]_[2b].vue` },
        { path: `${pagesDir}/[[c3@3c]].vue` },
        { path: `${pagesDir}/[[d4-4d]].vue` }
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
    },
    {
      description: 'should properly override route name if definePageMeta name override is defined.',
      files: [
        {
          path: `${pagesDir}/index.vue`,
          template: `
            <script setup lang="ts">
            definePageMeta({
              name: 'home'
            })
            </script>
          `
        }
      ],
      output: [
        {
          name: 'home',
          path: '/',
          file: `${pagesDir}/index.vue`,
          children: []
        }
      ]
    },
    {
      description: 'should allow pages with `:` in their path',
      files: [
        { path: `${pagesDir}/test:name.vue` }
      ],
      output: [
        {
          name: 'test:name',
          path: '/test\\:name',
          file: `${pagesDir}/test:name.vue`,
          children: []
        }
      ]
    },
    {
      description: 'should not merge required param as a child of optional param',
      files: [
        { path: `${pagesDir}/[[foo]].vue` },
        { path: `${pagesDir}/[foo].vue` }
      ],
      output: [
        {
          name: 'foo',
          path: '/:foo?',
          file: `${pagesDir}/[[foo]].vue`,
          children: [
          ]
        },
        {
          name: 'foo',
          path: '/:foo()',
          file: `${pagesDir}/[foo].vue`,
          children: []
        }
      ]
    },
    {
      description: 'should correctly merge nested routes',
      files: [
        { path: `${pagesDir}/param.vue` },
        { path: `${pagesDir}/param/index.vue` },
        { path: `${pagesDir}/param/index/index.vue` },
        { path: `${pagesDir}/param/index/sibling.vue` },
        { path: `${pagesDir}/wrapper-expose/other.vue` },
        { path: `${pagesDir}/wrapper-expose/other/index.vue` },
        { path: `${pagesDir}/wrapper-expose/other/sibling.vue` },
        { path: `${pagesDir}/param/sibling.vue` }
      ],
      output: [
        {
          children: [
            {
              children: [
                {
                  children: [],
                  file: 'pages/param/index/index.vue',
                  name: 'param-index',
                  path: ''
                },
                {
                  children: [],
                  file: 'pages/param/index/sibling.vue',
                  name: 'param-index-sibling',
                  path: 'sibling'
                }
              ],
              file: 'pages/param/index.vue',
              path: ''
            },
            {
              children: [],
              file: 'pages/param/sibling.vue',
              name: 'param-sibling',
              path: 'sibling'
            }
          ],
          file: 'pages/param.vue',
          path: '/param'
        },
        {
          children: [
            {
              children: [],
              file: 'pages/wrapper-expose/other/index.vue',
              name: 'wrapper-expose-other',
              path: ''
            },
            {
              children: [],
              file: 'pages/wrapper-expose/other/sibling.vue',
              name: 'wrapper-expose-other-sibling',
              path: 'sibling'
            }
          ],
          file: 'pages/wrapper-expose/other.vue',
          path: '/wrapper-expose/other'
        }
      ]
    }
  ]

  for (const test of tests) {
    it(test.description, async () => {
      const vfs = Object.fromEntries(
        test.files.map(file => [file.path, 'template' in file ? file.template : ''])
      ) as Record<string, string>

      let result
      try {
        result = await generateRoutesFromFiles(test.files.map(file => file.path), pagesDir, true, vfs)
      } catch (error: any) {
        expect(error.message).toEqual(test.error)
      }
      if (result) {
        expect(result).toEqual(test.output)
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

const pathToNitroGlobTests = {
  '/': '/',
  '/:id': '/**',
  '/:id()': '/**',
  '/:id?': '/**',
  '/some-:id?': '/**',
  '/other/some-:id?': '/other/**',
  '/other/some-:id()-more': '/other/**',
  '/other/nested': '/other/nested'
}

describe('pages:pathToNitroGlob', () => {
  it.each(Object.entries(pathToNitroGlobTests))('should convert %s to %s', (path, expected) => {
    expect(pathToNitroGlob(path)).to.equal(expected)
  })
})
