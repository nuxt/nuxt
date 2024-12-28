import { describe, expect, it } from 'vitest'
import { compileScript, parse } from '@vue/compiler-sfc'
import * as Parser from 'acorn'
import { transform as esbuildTransform } from 'esbuild'
import { PageMetaPlugin } from '../src/pages/plugins/page-meta'
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

  it('should parse JSX files', async () => {
    const fileContents = `
export default {
  setup () {
    definePageMeta({ name: 'bar' })
    return () => <div></div>
  }
}
    `
    const meta = await getRouteMeta(fileContents, `/app/pages/index.jsx`)
    expect(meta).toStrictEqual({
      name: 'bar',
    })
  })

  // TODO: https://github.com/nuxt/nuxt/pull/30066
  it.todo('should handle experimental decorators', async () => {
    const fileContents = `
<script setup lang="ts">
function something (_method: () => unknown) {
  return () => 'decorated'
}
class SomeClass {
  @something
  public someMethod () {
    return 'initial'
  }
}
definePageMeta({ name: 'bar' })
</script>
    `
    const meta = await getRouteMeta(fileContents, `/app/pages/index.vue`)
    expect(meta).toStrictEqual({
      name: 'bar',
    })
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

  it('should extract configured extra meta', async () => {
    const meta = await getRouteMeta(`
    <script setup>
    definePageMeta({
      foo: 'bar',
      bar: true,
    })
    </script>
    `, filePath, ['bar', 'foo'])

    expect(meta).toMatchInlineSnapshot(`
      {
        "bar": true,
        "foo": "bar",
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
          props: indexN6pT4Un8hYMeta?.props ?? false,
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

describe('rewrite page meta', () => {
  const transformPlugin = PageMetaPlugin().raw({}, {} as any) as { transform: (code: string, id: string) => { code: string } | null }

  it('should extract metadata from vue components', () => {
    const sfc = `
<script setup lang="ts">
definePageMeta({
  name: 'hi',
  other: 'value'
})
</script>
      `
    const res = compileScript(parse(sfc).descriptor, { id: 'component.vue' })
    expect(transformPlugin.transform.call({
      parse: (code: string, opts: any = {}) => Parser.parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        locations: true,
        ...opts,
      }),
    }, res.content, 'component.vue?macro=true')?.code).toMatchInlineSnapshot(`
      "const __nuxt_page_meta = {
        name: 'hi',
        other: 'value'
      }
      export default __nuxt_page_meta"
    `)
  })

  it('should extract local functions', () => {
    const sfc = `
<script setup lang="ts">
function isNumber(value) {
  return value && !isNaN(Number(value))
}

function validateIdParam (route) {
  return isNumber(route.params.id)
}

definePageMeta({
  validate: validateIdParam,
  test: () => 'hello',
})
</script>
      `
    const res = compileScript(parse(sfc).descriptor, { id: 'component.vue' })
    expect(transformPlugin.transform.call({
      parse: (code: string, opts: any = {}) => Parser.parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        locations: true,
        ...opts,
      }),
    }, res.content, 'component.vue?macro=true')?.code).toMatchInlineSnapshot(`
      "function isNumber(value) {
        return value && !isNaN(Number(value))
      }
      function validateIdParam (route) {
        return isNumber(route.params.id)
      }
      const __nuxt_page_meta = {
        validate: validateIdParam,
        test: () => 'hello',
      }
      export default __nuxt_page_meta"
    `)
  })

  it('should extract user imports', () => {
    const sfc = `
<script setup lang="ts">
import { validateIdParam } from './utils'

definePageMeta({
  validate: validateIdParam,
  dynamic: ref(true),
})
</script>
      `
    const res = compileScript(parse(sfc).descriptor, { id: 'component.vue' })
    expect(transformPlugin.transform.call({
      parse: (code: string, opts: any = {}) => Parser.parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        locations: true,
        ...opts,
      }),
    }, res.content, 'component.vue?macro=true')?.code).toMatchInlineSnapshot(`
      "import { validateIdParam } from './utils'

      const __nuxt_page_meta = {
        validate: validateIdParam,
        dynamic: ref(true),
      }
      export default __nuxt_page_meta"
    `)
  })

  it('should work with esbuild.keepNames = true', async () => {
    const sfc = `
<script setup lang="ts">
import { foo } from './utils'

const checkNum = (value) => {
  return !isNaN(Number(foo(value)))
}

function isNumber (value) {
  return value && checkNum(value)
}

definePageMeta({
  validate: ({ params }) => {
    return isNumber(params.id)
  },
})
</script>
      `
    const compiled = compileScript(parse(sfc).descriptor, { id: 'component.vue' })
    const res = await esbuildTransform(compiled.content, {
      loader: 'ts',
      keepNames: true,
    })
    expect(transformPlugin.transform.call({
      parse: (code: string, opts: any = {}) => Parser.parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        locations: true,
        ...opts,
      }),
    }, res.code, 'component.vue?macro=true')?.code).toMatchInlineSnapshot(`
      "import { foo } from "./utils";
      var __defProp = Object.defineProperty;
      var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
      const checkNum = /* @__PURE__ */ __name((value) => {
            return !isNaN(Number(foo(value)));
          }, "checkNum");
      function isNumber(value) {
            return value && checkNum(value);
          }
      const __nuxt_page_meta = {
            validate: /* @__PURE__ */ __name(({ params }) => {
              return isNumber(params.id);
            }, "validate")
          }
      export default __nuxt_page_meta"
    `)
  })

  it('should throw for await expressions', async () => {
    const sfc = `
<script setup lang="ts">
const asyncValue = await Promise.resolve('test')

definePageMeta({
  key: asyncValue,
})
</script>
      `
    const compiled = compileScript(parse(sfc).descriptor, { id: 'component.vue' })
    const res = await esbuildTransform(compiled.content, {
      loader: 'ts',
    })

    let wasErrorThrown = false

    try {
      transformPlugin.transform.call({
        parse: (code: string, opts: any = {}) => Parser.parse(code, {
          sourceType: 'module',
          ecmaVersion: 'latest',
          locations: true,
          ...opts,
        }),
      }, res.code, 'component.vue?macro=true')
    } catch (e) {
      if (e instanceof Error) {
        expect(e.message).toMatch(/await in definePageMeta/)
        wasErrorThrown = true
      }
    }

    expect(wasErrorThrown).toBe(true)
  })

  it('should only add definitions for reference identifiers', () => {
    const sfc = `
<script setup lang="ts">
const foo = 'foo'
const bar = { bar: 'bar' }.bar, baz = { baz: 'baz' }.baz, x = { foo }
const test = 'test'
const prop = 'prop'
const num = 1

const val = 'val'

const useVal = () => ({ val: 'val' })

function recursive () {
  recursive()
}

definePageMeta({
  middleware: [
    () => {
      console.log(bar, baz)
      recursive()

      const val = useVal().val
      const obj = {
        num,
        prop: 'prop',
      }

      const c = class test {
        prop = 'prop'
        test () {}
      }
    },
  ],
})
</script>
      `
    const res = compileScript(parse(sfc).descriptor, { id: 'component.vue' })
    expect(transformPlugin.transform.call({
      parse: (code: string, opts: any = {}) => Parser.parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        locations: true,
        ...opts,
      }),
    }, res.content, 'component.vue?macro=true')?.code).toMatchInlineSnapshot(`
      "const foo = 'foo'
      const num = 1
      const bar = { bar: 'bar' }.bar, baz = { baz: 'baz' }.baz, x = { foo }
      const useVal = () => ({ val: 'val' })
      function recursive () {
        recursive()
      }
      const __nuxt_page_meta = {
        middleware: [
          () => {
            console.log(bar, baz)
            recursive()

            const val = useVal().val
            const obj = {
              num,
              prop: 'prop',
            }

            const c = class test {
              prop = 'prop'
              test () {}
            }
          },
        ],
      }
      export default __nuxt_page_meta"
    `)
  })
})
