import type { TestAPI } from 'vitest'
import { describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { augmentPages, generateRoutesFromFiles, normalizeRoutes, pathToNitroGlob } from '../src/pages/utils'
import type { RouterViewSlotProps } from '../src/pages/runtime/utils'
import { generateRouteKey } from '../src/pages/runtime/utils'
import type { NuxtPage } from 'nuxt/schema'

describe('pages:generateRoutesFromFiles', () => {
  vi.mock('knitwork', async (original) => {
    return {
      ...(await original<typeof import('knitwork')>()),
      genArrayFromRaw: (val: any) => val,
      genSafeVariableName: (..._args: string[]) => {
        return 'mock'
      },
    }
  })

  const normalizedResults: Record<string, any> = {}
  const normalizedOverrideMetaResults: Record<string, any> = {}

  const enUSComparator = new Intl.Collator('en-US')
  function sortRoutes (routes: NuxtPage[]) {
    for (const route of routes) {
      route.children &&= sortRoutes([...route.children])
    }
    return [...routes].sort((a, b) => enUSComparator.compare(b.path, a.path))
  }

  for (const test of pageTests) {
    const _it = test.it || it
    _it(test.description, async () => {
      let result
      if (test.files) {
        const vfs = Object.fromEntries(
          test.files.map(file => [file.path, 'template' in file ? file.template : '']),
        ) as Record<string, string>

        try {
          const files = test.files.map(file => ({
            shouldUseServerComponents: true,
            absolutePath: file.path,
            relativePath: file.path.replace(/^(pages|layer\/pages)\//, ''),
          })).sort((a, b) => enUSComparator.compare(a.relativePath, b.relativePath))

          result = generateRoutesFromFiles(files).map((route, index) => {
            return {
              ...route,
              meta: test.files![index]!.meta,
            }
          })

          await augmentPages(result, vfs)
        } catch (error: any) {
          expect(error.message).toEqual(test.error)
        }
      } else {
        result = test.output ?? []
      }

      if (result) {
        expect.soft(sortRoutes(result)).toEqual(test.output ? sortRoutes(test.output) : undefined)

        normalizedResults[test.description] = normalizeRoutes(result, new Set(), {
          clientComponentRuntime: '<client-component-runtime>',
          serverComponentRuntime: '<server-component-runtime>',
          overrideMeta: false,
        }).routes

        normalizedOverrideMetaResults[test.description] = normalizeRoutes(result, new Set(), {
          clientComponentRuntime: '<client-component-runtime>',
          serverComponentRuntime: '<server-component-runtime>',
          overrideMeta: true,
        }).routes
      }
    })
  }

  it('should consistently normalize routes', async () => {
    await expect(normalizedResults).toMatchFileSnapshot('./__snapshots__/pages-override-meta-disabled.test.ts.snap')
  })

  it('should consistently normalize routes when overriding meta', async () => {
    await expect(normalizedOverrideMetaResults).toMatchFileSnapshot('./__snapshots__/pages-override-meta-enabled.test.ts.snap')
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

  const tests: Array<{
    description: string
    route: RouterViewSlotProps
    override?: string | ((route: RouteLocationNormalizedLoaded) => string)
    output?: string | false
    it?: TestAPI
  }> = [
    { description: 'should handle overrides', override: 'key', route: getRouteProps(), output: 'key' },
    { description: 'should handle overrides', override: route => route.meta.key as string, route: getRouteProps(), output: 'route-meta-key' },
    {
      description: 'should handle overrides',
      // @ts-expect-error testing behaviour with invalid prop
      override: false,
      route: getRouteProps(),
      output: false,
    },
    {
      description: 'should key dynamic routes without keys',
      route: getRouteProps({
        path: '/test/:id',
        meta: {},
      }),
      output: '/test/foo',
    },
    {
      description: 'should key dynamic routes without keys',
      route: getRouteProps({
        path: '/test/:id(\\d+)',
        meta: {},
      }),
      output: '/test/foo',
    },
    {
      description: 'should key dynamic routes with optional params',
      route: getRouteProps({
        path: '/test/:optional?',
        meta: {},
      }),
      output: '/test/bar',
    },
    {
      description: 'should key dynamic routes with optional params',
      route: getRouteProps({
        path: '/test/:optional(\\d+)?',
        meta: {},
      }),
      output: '/test/bar',
    },
    {
      description: 'should key dynamic routes with optional params',
      route: getRouteProps({
        path: '/test/:undefined(\\d+)?',
        meta: {},
      }),
      output: '/test/',
    },
    {
      description: 'should key dynamic routes with array params',
      route: getRouteProps({
        path: '/:array+',
        meta: {},
      }),
      output: '/a,b',
    },
    {
      description: 'should key dynamic routes with array params',
      route: getRouteProps({
        path: '/test/:array*',
        meta: {},
      }),
      output: '/test/a,b',
    },
    {
      description: 'should key dynamic routes with array params',
      route: getRouteProps({
        path: '/test/:other*',
        meta: {},
      }),
      output: '/test/',
    },
  ]

  for (const test of tests) {
    const _it = test.it || it
    _it(test.description, () => {
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
  '/other/nested': '/other/nested',
}

describe('pages:pathToNitroGlob', () => {
  it.each(Object.entries(pathToNitroGlobTests))('should convert %s to %s', (path, expected) => {
    expect(pathToNitroGlob(path)).to.equal(expected)
  })
})

describe('page:extends', () => {
  const DYNAMIC_META_KEY = '__nuxt_dynamic_meta_key' as const
  it('should preserve distinct metadata for multiple routes referencing the same file', async () => {
    const files: NuxtPage[] = [
      { path: 'home', file: `pages/index.vue` },
      { path: 'home1', file: `pages/index.vue`, meta: { test: true } },
      { path: 'home2', file: `pages/index.vue`, meta: { snap: true } },
    ]
    const vfs = Object.fromEntries(
      files.map(file => [file.file, `
            <script setup lang="ts">
            definePageMeta({
              hello: 'world'
            })
            </script>
          `]),
    ) as Record<string, string>
    await augmentPages(files, vfs)
    expect(files).toEqual([
      {
        path: 'home',
        file: `pages/index.vue`,
        meta: { [DYNAMIC_META_KEY]: new Set(['meta']) },
      },
      {
        path: 'home1',
        file: `pages/index.vue`,
        meta: { [DYNAMIC_META_KEY]: new Set(['meta']), test: true },
      },
      {
        path: 'home2',
        file: `pages/index.vue`,
        meta: { [DYNAMIC_META_KEY]: new Set(['meta']), snap: true },
      },
    ])
  })
})

const pagesDir = 'pages'
const layerDir = 'layer/pages'
const DYNAMIC_META_KEY = '__nuxt_dynamic_meta_key' as const

export const pageTests: Array<{
  description: string
  files?: Array<{ path: string, template?: string, meta?: Record<string, any> }>
  output?: NuxtPage[]
  it?: TestAPI
  normalized?: Record<string, any>[]
  error?: string
}> = [
  {
    description: 'should generate correct routes for index pages',
    files: [
      { path: `${pagesDir}/index.vue` },
      { path: `${pagesDir}/parent/index.vue` },
      { path: `${pagesDir}/parent/child/index.vue` },
    ],
    output: [
      {
        name: 'index',
        path: '/',
        file: `${pagesDir}/index.vue`,
        children: [],
      },
      {
        name: 'parent',
        path: '/parent',
        file: `${pagesDir}/parent/index.vue`,
        children: [],
      },
      {
        name: 'parent-child',
        path: '/parent/child',
        file: `${pagesDir}/parent/child/index.vue`,
        children: [],
      },
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
        children: [
          {
            name: 'parent-child',
            path: 'child',
            file: `${pagesDir}/parent/child.vue`,
            children: [],
          },
        ],
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
      {
        name: 'parent-child',
        path: '/parent/:child()',
        file: `${pagesDir}/parent/[child].vue`,
        children: [],
      },
      {
        name: 'parent-child',
        path: '/parent-:child()',
        file: `${pagesDir}/parent-[child].vue`,
        children: [],
      },
    ],
  },
  {
    description: 'should generate correct id for catchall (order 1)',
    files: [
      { path: `${pagesDir}/[...stories].vue` },
      { path: `${pagesDir}/stories/[id].vue` },
    ],
    output: [
      {
        name: 'stories',
        path: '/:stories(.*)*',
        file: `${pagesDir}/[...stories].vue`,
        children: [],
      },
      {
        name: 'stories-id',
        path: '/stories/:id()',
        file: `${pagesDir}/stories/[id].vue`,
        children: [],
      },
    ],
  },
  {
    description: 'should generate correct id for catchall (order 2)',
    files: [
      { path: `${pagesDir}/stories/[id].vue` },
      { path: `${pagesDir}/[...stories].vue` },
    ],
    output: [
      {
        name: 'stories-id',
        path: '/stories/:id()',
        file: `${pagesDir}/stories/[id].vue`,
        children: [],
      },
      {
        name: 'stories',
        path: '/:stories(.*)*',
        file: `${pagesDir}/[...stories].vue`,
        children: [],
      },
    ],
  },
  {
    description: 'should generate correct route for snake_case file',
    files: [
      { path: `${pagesDir}/snake_case.vue` },
    ],
    output: [
      {
        name: 'snake_case',
        path: '/snake_case',
        file: `${pagesDir}/snake_case.vue`,
        children: [],
      },
    ],
  },
  {
    description: 'should generate correct route for kebab-case file',
    files: [{ path: `${pagesDir}/kebab-case.vue` }],
    output: [
      {
        name: 'kebab-case',
        path: '/kebab-case',
        file: `${pagesDir}/kebab-case.vue`,
        children: [],
      },
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
        children: [
          {

            name: 'foo',
            path: '',
            file: `${pagesDir}/[[foo]]/index.vue`,
            children: [],
          },
        ],
        file: `${pagesDir}/[[foo]]`,
        path: '/:foo?',
      },
      {
        name: 'index',
        path: '/',
        file: `${pagesDir}/index.vue`,
        children: [],
      },
      {
        children: [],
        name: 'slug',
        file: `${pagesDir}/[slug].vue`,
        path: '/:slug()',
      },
      {
        children: [],
        name: 'bar',
        file: `${pagesDir}/[bar]/index.vue`,
        path: '/:bar()',
      },
      {
        name: 'opt-slug',
        path: '/opt/:slug?',
        file: `${pagesDir}/opt/[[slug]].vue`,
        children: [],
      },
      {
        name: 'nonopt-slug',
        path: '/nonopt/:slug()',
        file: `${pagesDir}/nonopt/[slug].vue`,
        children: [],
      },
      {
        children: [],
        path: '/optional/:opt?',
        name: 'optional-opt',
        file: `${pagesDir}/optional/[[opt]].vue`,
      },
      {
        name: 'sub-route-slug',
        path: '/:sub?/route-:slug()',
        file: `${pagesDir}/[[sub]]/route-[slug].vue`,
        children: [],
      },
      {
        children: [],
        path: '/optional/prefix-:opt?',
        name: 'optional-prefix-opt',
        file: `${pagesDir}/optional/prefix-[[opt]].vue`,
      },

      {
        children: [],
        path: '/optional/:opt?-postfix',
        name: 'optional-opt-postfix',
        file: `${pagesDir}/optional/[[opt]]-postfix.vue`,
      },
      {
        children: [],
        path: '/optional/prefix-:opt?-postfix',
        name: 'optional-prefix-opt-postfix',
        file: `${pagesDir}/optional/prefix-[[opt]]-postfix.vue`,
      },
    ],
  },
  {
    description: 'should generate correct catch-all route',
    files: [{ path: `${pagesDir}/[...slug].vue` }, { path: `${pagesDir}/index.vue` }, { path: `${pagesDir}/[...slug]/[id].vue` }],
    output: [
      {
        name: 'index',
        path: '/',
        file: `${pagesDir}/index.vue`,
        children: [],
      },
      {
        name: 'slug',
        path: '/:slug(.*)*',
        file: `${pagesDir}/[...slug].vue`,
        children: [
          {
            name: 'slug-id',
            path: ':id()',
            file: `${pagesDir}/[...slug]/[id].vue`,
            children: [],
          }],
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
    files: [
      { path: `${pagesDir}/[].vue` },
    ],
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
      {
        name: 'a1_1a',
        path: '/:a1_1a()',
        file: `${pagesDir}/[a1_1a].vue`,
        children: [],
      },
      {
        name: 'b2.2b',
        path: '/:b2.2b()',
        file: `${pagesDir}/[b2.2b].vue`,
        children: [],
      },
      {
        name: 'b2_2b',
        path: '/:b2()_:2b()',
        file: `${pagesDir}/[b2]_[2b].vue`,
        children: [],
      },
      {
        name: 'c33c',
        path: '/:c33c?',
        file: `${pagesDir}/[[c3@3c]].vue`,
        children: [],
      },
      {
        name: 'd44d',
        path: '/:d44d?',
        file: `${pagesDir}/[[d4-4d]].vue`,
        children: [],
      },
    ],
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
          `,
      },
    ],
    output: [
      {
        name: 'home',
        path: '/',
        file: `${pagesDir}/index.vue`,
        children: [],
      },
    ],
  },
  {
    description: 'should allow pages with `:` in their path',
    files: [
      { path: `${pagesDir}/test:name.vue` },
    ],
    output: [
      {
        name: 'test:name',
        path: '/test\\:name',
        file: `${pagesDir}/test:name.vue`,
        children: [],
      },
    ],
  },
  {
    description: 'should not merge required param as a child of optional param',
    files: [
      { path: `${pagesDir}/[[foo]].vue` },
      { path: `${pagesDir}/[foo].vue` },
    ],
    output: [
      {
        name: 'foo',
        path: '/:foo()',
        file: `${pagesDir}/[foo].vue`,
        children: [],
      },
      {
        name: 'foo',
        path: '/:foo?',
        file: `${pagesDir}/[[foo]].vue`,
        children: [
        ],
      },
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
        children: [
          {
            children: [
              {
                children: [],
                file: `${pagesDir}/param/index/index.vue`,
                name: 'param-index',
                path: '',
              },
              {
                children: [],
                file: `${layerDir}/param/index/sibling.vue`,
                name: 'param-index-sibling',
                path: 'sibling',
              },
            ],
            file: `${layerDir}/param/index.vue`,
            path: '',
          },
          {
            children: [],
            file: `${pagesDir}/param/sibling.vue`,
            name: 'param-sibling',
            path: 'sibling',
          },
        ],
        file: `${pagesDir}/param.vue`,
        path: '/param',
      },
      {
        children: [
          {
            children: [],
            file: `${layerDir}/wrapper-expose/other/index.vue`,
            name: 'wrapper-expose-other',
            path: '',
          },
          {
            children: [],
            file: `${pagesDir}/wrapper-expose/other/sibling.vue`,
            name: 'wrapper-expose-other-sibling',
            path: 'sibling',
          },
        ],
        file: `${pagesDir}/wrapper-expose/other.vue`,
        path: '/wrapper-expose/other',
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
        children: [
          {
            children: [],
            file: `${pagesDir}/index/index/all.vue`,
            name: 'index-index-all',
            path: 'all',
          },
        ],
        file: `${pagesDir}/index/index.vue`,
        name: 'index',
        path: '/',
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
        children: [
          {
            children: [],
            file: `${pagesDir}/page1/[id].vue`,
            name: 'page1-id',
            path: ':id()',
          },
          {
            children: [],
            file: `${pagesDir}/page1/index.vue`,
            name: 'page1',
            path: '',
          },
        ],
        file: `${pagesDir}/page1.vue`,
        path: '/page1',
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
    output: [
      {
        name: 'index',
        path: '/',
        file: `${pagesDir}/index.vue`,
        meta: { [DYNAMIC_META_KEY]: new Set(['name', 'alias', 'redirect', 'meta']) },
        children: [],
      },
    ],
  },
  {
    description: 'should extract serializable values and override fallback when normalized with `overrideMeta: true`',
    files: [
      {
        path: `${pagesDir}/index.vue`,
        template: `
            <script setup lang="ts">
            definePageMeta({
              name: 'home',
              alias: ['sweet-home'],
              redirect: '/',
              hello: 'world'
            })
            </script>
          `,
      },
    ],
    output: [
      {
        name: 'home',
        path: '/',
        file: `${pagesDir}/index.vue`,
        alias: ['sweet-home'],
        redirect: '/',
        children: [],
        meta: { [DYNAMIC_META_KEY]: new Set(['meta']) },
      },
    ],
  },
  {
    description: 'route without file',
    output: [
      {
        name: 'home',
        path: '/',
        alias: ['sweet-home'],
        meta: { hello: 'world' },
      },
    ],
  },
  {
    description: 'pushed route, skips generation from file',
    output: [
      {
        name: 'pushed-route',
        path: '/',
        alias: ['pushed-route-alias'],
        meta: { someMetaData: true },
        file: `${pagesDir}/route-file.vue`,
      },
    ],
  },
  {
    description: 'route.meta generated from file',
    files: [
      {
        path: `${pagesDir}/page-with-meta.vue`,
        meta: {
          test: 1,
        },
      },
    ],
    output: [
      {
        name: 'page-with-meta',
        path: '/page-with-meta',
        file: `${pagesDir}/page-with-meta.vue`,
        children: [],
        meta: { test: 1 },
      },
    ],
  },
  {
    description: 'should use more performant regexp when catchall is used in middle of path',
    files: [
      {
        path: `${pagesDir}/[...id]/suffix.vue`,
      },
      {
        path: `${pagesDir}/[...id]/index.vue`,
      },
    ],
    output: [
      {
        name: 'id',
        meta: undefined,
        path: '/:id(.*)*',
        file: `${pagesDir}/[...id]/index.vue`,
        children: [],
      },
      {
        name: 'id-suffix',
        meta: undefined,
        path: '/:id([^/]*)*/suffix',
        file: `${pagesDir}/[...id]/suffix.vue`,
        children: [],
      },
    ],
  },
  {
    description: 'should merge route.meta with meta from file',
    files: [
      {
        path: `${pagesDir}/page-with-meta.vue`,
        meta: {
          test: 1,
        },
        template: `
            <script setup lang="ts">
            definePageMeta({
              hello: 'world'
            })
            </script>
          `,
      },
    ],
    output: [
      {
        name: 'page-with-meta',
        path: '/page-with-meta',
        file: `${pagesDir}/page-with-meta.vue`,
        children: [],
        meta: { [DYNAMIC_META_KEY]: new Set(['meta']), test: 1 },
      },
    ],
  },
  {
    description: 'route.meta props generate by file',
    files: [
      {
        path: `${pagesDir}/page-with-props.vue`,
        template: `
            <script setup lang="ts">
            definePageMeta({
              props: true
            })
            </script>
          `,
      },
    ],
    output: [
      {
        name: 'page-with-props',
        path: '/page-with-props',
        file: `${pagesDir}/page-with-props.vue`,
        children: [],
        props: true,
      },
    ],
  },
  {
    description: 'should handle route groups',
    files: [
      { path: `${pagesDir}/(foo)/index.vue` },
      { path: `${pagesDir}/(foo)/about.vue` },
      { path: `${pagesDir}/(bar)/about/index.vue` },
    ],
    output: [
      {
        name: 'index',
        path: '/',
        file: `${pagesDir}/(foo)/index.vue`,
        meta: undefined,
        children: [],
      },
      {
        path: '/about',
        file: `${pagesDir}/(foo)/about.vue`,
        meta: undefined,
        children: [

          {
            name: 'about',
            path: '',
            file: `${pagesDir}/(bar)/about/index.vue`,
            children: [],
          },
        ],
      },
    ],
  },
]
