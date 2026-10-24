import { describe, expect, it } from 'vitest'
import { applyDefaults } from 'untyped'
import { createUnimport } from 'unimport'
import { NuxtConfigSchema } from '@nuxt/schema'
import type { NuxtOptions } from '@nuxt/schema'

import { TreeShakeComposablesPlugin } from '../src/core/plugins/tree-shake.ts'
import { defaultPresets } from '../src/imports/presets.ts'
import { pagesImportPresets } from '../src/pages/module.ts'
import { clean } from './utils.ts'

describe('tree-shake', () => {
  const transformPlugin: any = TreeShakeComposablesPlugin({
    composables: { 'vue': ['onMounted'] },
  }).raw({}, {} as any)

  it('should tree shake composables from source code', () => {
    const code = `
      onMounted(() => {})
      console.log('Hello World')
    `
    const { code: result } = transformPlugin.transform.handler(code, 'test.js')
    expect(clean(result)).toMatchInlineSnapshot(`
      " false && /*@__PURE__*/ onMounted(() => {})
      console.log('Hello World')"
    `)
  })

  it('should tree-shake explicitly-imported composables', () => {
    const code = `
      import { onMounted as _onMounted } from 'vue'
      _onMounted(() => {})
      console.log('Hello World')
    `
    const { code: result } = transformPlugin.transform.handler(code, 'test.js')
    expect(clean(result)).toMatchInlineSnapshot(`
      "import { onMounted as _onMounted } from 'vue'
       false && /*@__PURE__*/ _onMounted(() => {})
      console.log('Hello World')"
    `)
  })

  it('should not error when tree-shaking composables within other tree-shaken composables', () => {
    const code = `
      import { onMounted } from 'vue'
      onMounted(() => {
        onMounted(() => {})
      })
      onMounted(() => {})
    `
    const { code: result } = transformPlugin.transform.handler(code, 'test.js')
    expect(clean(result)).toMatchInlineSnapshot(`
      "import { onMounted } from 'vue'
       false && /*@__PURE__*/ onMounted(() => {
        onMounted(() => {})
      })
       false && /*@__PURE__*/ onMounted(() => {})"
    `)
  })

  it('should tree-shake explicitly-imported composables from #imports', () => {
    const code = `
      import { onMounted } from '#imports'
      onMounted(() => {})
      console.log('Hello World')
    `
    const { code: result } = transformPlugin.transform.handler(code, 'test.js')
    expect(clean(result)).toMatchInlineSnapshot(`
      "import { onMounted } from '#imports'
       false && /*@__PURE__*/ onMounted(() => {})
      console.log('Hello World')"
    `)
  })

  it('should tree-shake the default #app composables when they are auto-imported', async () => {
    const { optimization } = await applyDefaults(NuxtConfigSchema, { dev: false }) as unknown as NuxtOptions
    const ctx = createUnimport({ presets: [...defaultPresets, ...pagesImportPresets] })
    const transform = async (composables: Record<string, string[]>) => {
      const names = new Set(Object.entries(composables).flatMap(([key, names]) => key.startsWith('#app') ? names : []))
      const { code } = await ctx.injectImports([...names].map(name => `${name}()`).join('\n'))
      const plugin: any = TreeShakeComposablesPlugin({ composables }).raw({}, {} as any)
      return clean(plugin.transform.handler(code, 'test.js')?.code ?? code)
    }
    expect(await transform(optimization.treeShake.composables.server)).toMatchInlineSnapshot(`
      "import { definePayloadReviver } from '#app/composables/payload';
      import { definePageMeta } from '#app/composables/pages';
       false && /*@__PURE__*/ definePayloadReviver()
       false && /*@__PURE__*/ definePageMeta()"
    `)
    expect(await transform(optimization.treeShake.composables.client)).toMatchInlineSnapshot(`
      "import { definePayloadReducer } from '#app/composables/payload';
      import { definePageMeta } from '#app/composables/pages';
      import { onPrehydrate } from '#app/composables/ssr';
       false && /*@__PURE__*/ definePayloadReducer()
       false && /*@__PURE__*/ definePageMeta()
       false && /*@__PURE__*/ onPrehydrate()"
    `)
  })

  it('should replace stubbed composables with a call to the stub without the first argument', () => {
    const plugin: any = TreeShakeComposablesPlugin({
      composables: { 'vue': ['onServerPrefetch'] },
      stubs: { onServerPrefetch: '#app/composables/server-prefetch' },
    }).raw({}, {} as any)
    const code = `
      import { onServerPrefetch as _onServerPrefetch } from 'vue'
      onServerPrefetch(async () => { await serverOnly() })
      _onServerPrefetch(() => serverOnly(), instance)
    `
    const { code: result } = plugin.transform.handler(code, 'test.js')
    expect(clean(result)).toMatchInlineSnapshot(`
      "import { onServerPrefetch as __nuxt_stub_onServerPrefetch } from "#app/composables/server-prefetch";
            import { onServerPrefetch as _onServerPrefetch } from 'vue'
            __nuxt_stub_onServerPrefetch()
            __nuxt_stub_onServerPrefetch(instance)"
    `)
  })

  it('should not tree-shake composables from other paths', () => {
    const code = `
      import { onMounted } from 'other-path'
      onMounted(() => {})
      console.log('Hello World')
    `
    const result = transformPlugin.transform.handler(code, 'test.js')
    expect(result).toBeUndefined()
  })

  it('should not tree-shake object properties', () => {
    const code = `
      console.log({
        onMounted(_) {}
      })
    `
    const result = transformPlugin.transform.handler(code, 'test.js')
    expect(result).toBeUndefined()
  })

  it('should handle shadowing of outer-scope composables', () => {
    const code = `
      import { onMounted } from '#imports'

      onMounted(() => console.log('treeshake this'))

      function foo() {
        onMounted()

        function onMounted() {
          console.log('do not treeshake this')
        }
      }
    `
    const { code: result } = transformPlugin.transform.handler(code, 'test.js')
    expect(clean(result)).toMatchInlineSnapshot(`
      "import { onMounted } from '#imports'
       false && /*@__PURE__*/ onMounted(() => console.log('treeshake this'))
      function foo() {
        onMounted()
        function onMounted() {
          console.log('do not treeshake this')
        }
      }"
    `)
  })

  it('should handle variable shadowing', () => {
    const code = `
      import { onMounted } from '#imports'

      onMounted()

      function test() {
        const onMounted = () => 'local'
        onMounted()
      }
    `
    const { code: result } = transformPlugin.transform.handler(code, 'test.js')
    expect(clean(result)).toMatchInlineSnapshot(`
      "import { onMounted } from '#imports'
       false && /*@__PURE__*/ onMounted()
      function test() {
        const onMounted = () => 'local'
        onMounted()
      }"
    `)
  })

  it('should handle usage in function parameter', () => {
    const code = `
      import { onMounted } from '#imports'
      test(123, onMounted(), 456)
    `
    const { code: result } = transformPlugin.transform.handler(code, 'test.js')
    expect(clean(result)).toMatchInlineSnapshot(`
      "import { onMounted } from '#imports'
      test(123,  false && /*@__PURE__*/ onMounted(), 456)"
    `)
  })

  it('should handle assignments', () => {
    const code = `
      import { onMounted } from '#imports'

      let a
      a = onMounted()
      b = 3
    `
    const { code: result } = transformPlugin.transform.handler(code, 'test.js')
    expect(clean(result)).toMatchInlineSnapshot(`
      "import { onMounted } from '#imports'
      let a
      a =  false && /*@__PURE__*/ onMounted()
      b = 3"
    `)
  })

  it('should handle conditional/test/logical contexts', () => {
    const code = `
    import { onMounted } from 'vue'
    if (onMounted()) {}
    onMounted() && doThing()
    doThing() || onMounted()
    const x = cond ? onMounted() : 0
  `
    const { code: result } = transformPlugin.transform.handler(code, 'test.js')
    expect(clean(result)).toMatchInlineSnapshot(`
      "import { onMounted } from 'vue'
      if ( false && /*@__PURE__*/ onMounted()) {}
       false && /*@__PURE__*/ onMounted() && doThing()
      doThing() ||  false && /*@__PURE__*/ onMounted()
      const x = cond ?  false && /*@__PURE__*/ onMounted() : 0"
    `)
  })

  it('should handle sequence in expression statement', () => {
    const code = `
    import { onMounted } from 'vue'
    (foo(), onMounted(), bar())
  `
    const { code: result } = transformPlugin.transform.handler(code, 'test.js')
    expect(clean(result)).toMatchInlineSnapshot(`
      "import { onMounted } from 'vue'
      (foo(),  false && /*@__PURE__*/ onMounted(), bar())"
    `)
  })
})
