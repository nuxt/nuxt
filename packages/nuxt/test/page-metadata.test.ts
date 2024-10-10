import { describe, expect, it } from 'vitest'
import { getRouteMeta, normalizeRoutes } from '../src/pages/utils'
import type { NuxtPage } from '../schema'

const filePath = '/app/pages/index.vue'

describe('page metadata', () => {
  it('should not extract metadata from empty files', async () => {
    expect(await getRouteMeta('', filePath)).toEqual({})
    expect(await getRouteMeta('<template><div>Hi</div></template>', filePath)).toEqual({})
  })

  it('should extract metadata from JS/JSX files', async () => {
    const fileContents = `definePageMeta({ name: 'bar' })`
    for (const ext of ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs']) {
      const meta = await getRouteMeta(fileContents, `/app/pages/index.${ext}`)
      expect(meta).toStrictEqual({
        name: 'bar',
      })
    }
  })

  it('should use and invalidate cache', async () => {
    const fileContents = `<script setup>definePageMeta({ foo: 'bar' })</script>`
    const meta = await getRouteMeta(fileContents, filePath)
    expect(meta === await getRouteMeta(fileContents, filePath)).toBeTruthy()
    expect(meta === await getRouteMeta(fileContents, '/app/pages/other.vue')).toBeFalsy()
    expect(meta === await getRouteMeta('<template><div>Hi</div></template>' + fileContents, filePath)).toBeFalsy()
  })

  it('should extract serialisable metadata', async () => {
    const meta = await getRouteMeta(`
    <script setup>
    definePageMeta({
      name: 'some-custom-name',
      path: '/some-custom-path',
      validate: () => true,
      middleware: [
        function () {},
      ],
      otherValue: {
        foo: 'bar',
      },
    })
    </script>
    `, filePath)

    expect(meta).toMatchInlineSnapshot(`
      {
        "meta": {
          "__nuxt_dynamic_meta_key": Set {
            "meta",
          },
        },
        "name": "some-custom-name",
        "path": "/some-custom-path",
      }
    `)
  })

  it('should extract serialisable metadata from files with multiple blocks', async () => {
    const meta = await getRouteMeta(`
    <script lang="ts">
    export default {
      name: 'thing'
    }
    </script>
    <script setup>
    definePageMeta({
      name: 'some-custom-name',
      path: '/some-custom-path',
      validate: () => true,
      middleware: [
        function () {},
      ],
      otherValue: {
        foo: 'bar',
      },
    })
    </script>
    `, filePath)

    expect(meta).toMatchInlineSnapshot(`
      {
        "meta": {
          "__nuxt_dynamic_meta_key": Set {
            "meta",
          },
        },
        "name": "some-custom-name",
        "path": "/some-custom-path",
      }
    `)
  })

  it('should extract serialisable metadata in options api', async () => {
    const meta = await getRouteMeta(`
    <script>
    export default {
      setup() {
        definePageMeta({
          name: 'some-custom-name',
          path: '/some-custom-path',
          middleware: (from, to) => console.warn('middleware'),
        })
      },
    };
    </script>
    `, filePath)

    expect(meta).toMatchInlineSnapshot(`
      {
        "meta": {
          "__nuxt_dynamic_meta_key": Set {
            "meta",
          },
        },
        "name": "some-custom-name",
        "path": "/some-custom-path",
      }
    `)
  })

  it('should extract serialisable metadata all quoted', async () => {
    const meta = await getRouteMeta(`
    <script setup>
    definePageMeta({
      "otherValue": {
        foo: 'bar',
      },
    })
    </script>
    `, filePath)

    expect(meta).toMatchInlineSnapshot(`
      {
        "meta": {
          "__nuxt_dynamic_meta_key": Set {
            "meta",
          },
        },
      }
    `)
  })
})

describe('normalizeRoutes', () => {
  it('should produce valid route objects when used with extracted meta', async () => {
    const page: NuxtPage = { path: '/', file: filePath }
    Object.assign(page, await getRouteMeta(`
      <script setup>
      definePageMeta({
        name: 'some-custom-name',
        path: ref('/some-custom-path'), /* dynamic */
        validate: () => true,
        redirect: '/',
        middleware: [
          function () {},
        ],
        otherValue: {
          foo: 'bar',
        },
      })
      </script>
      `, filePath))

    page.meta ||= {}
    page.meta.layout = 'test'
    page.meta.foo = 'bar'

    const { routes, imports } = normalizeRoutes([page], new Set(), {
      clientComponentRuntime: '<client-component-runtime>',
      serverComponentRuntime: '<server-component-runtime>',
      overrideMeta: true,
    })
    expect({ routes, imports }).toMatchInlineSnapshot(`
      {
        "imports": Set {
          "import { default as indexN6pT4Un8hYMeta } from "/app/pages/index.vue?macro=true";",
        },
        "routes": "[
        {
          name: "some-custom-name",
          path: indexN6pT4Un8hYMeta?.path ?? "/",
          meta: { ...(indexN6pT4Un8hYMeta || {}), ...{"layout":"test","foo":"bar"} },
          redirect: "/",
          component: () => import("/app/pages/index.vue")
        }
      ]",
      }
    `)
  })

  it('should produce valid route objects when used without extracted meta', () => {
    const page: NuxtPage = { path: '/', file: filePath }
    page.meta ||= {}
    page.meta.layout = 'test'
    page.meta.foo = 'bar'

    const { routes, imports } = normalizeRoutes([page], new Set(), {
      clientComponentRuntime: '<client-component-runtime>',
      serverComponentRuntime: '<server-component-runtime>',
      overrideMeta: false,
    })
    expect({ routes, imports }).toMatchInlineSnapshot(`
      {
        "imports": Set {
          "import { default as indexN6pT4Un8hYMeta } from "/app/pages/index.vue?macro=true";",
        },
        "routes": "[
        {
          name: indexN6pT4Un8hYMeta?.name ?? undefined,
          path: indexN6pT4Un8hYMeta?.path ?? "/",
          meta: { ...(indexN6pT4Un8hYMeta || {}), ...{"layout":"test","foo":"bar"} },
          alias: indexN6pT4Un8hYMeta?.alias || [],
          redirect: indexN6pT4Un8hYMeta?.redirect,
          component: () => import("/app/pages/index.vue")
        }
      ]",
      }
    `)
  })
})
