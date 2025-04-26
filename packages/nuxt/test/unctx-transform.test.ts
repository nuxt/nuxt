import { describe, expect, it } from 'vitest'

import { UnctxTransformPlugin } from '../src/core/plugins/unctx'

describe('unctx transform in nuxt', () => {
  it('should transform nuxt plugins', async () => {
    const code = `
      export default defineNuxtPlugin({
        async setup () {
          await Promise.resolve()
        }
      })
    `
    expect(await transform(code)).toMatchInlineSnapshot(`
      "/* _processed_nuxt_unctx_transform */
      import { executeAsync as __executeAsync } from "unctx";
      export default defineNuxtPlugin({
        async setup () {let __temp, __restore;
          ;(([__temp,__restore]=__executeAsync(()=>Promise.resolve())),await __temp,__restore());
        }
      },1)"
    `)
  })

  it('should transform vue components using defineNuxtComponent', async () => {
    const code = `
      definePageMeta({
        async middleware() {
          await Promise.resolve()
        }
      })
      export default defineNuxtComponent({
        async setup () {
          await Promise.resolve()
        }
      })
    `
    expect(await transform(code, 'app.ts')).toMatchInlineSnapshot(`
      "/* _processed_nuxt_unctx_transform */
      import { executeAsync as __executeAsync } from "unctx";
      definePageMeta({
        async middleware() {let __temp, __restore;
          ;(([__temp,__restore]=__executeAsync(()=>Promise.resolve())),await __temp,__restore());
        }
      })
      export default defineNuxtComponent({
        async setup () {let __temp, __restore;
          ;(([__temp,__restore]=__executeAsync(()=>Promise.resolve())),await __temp,__restore());
        }
      })"
    `)
  })
})

function transform (code: string, id = 'app.vue') {
  const transformerOptions = {
    helperModule: 'unctx',
    asyncFunctions: ['defineNuxtPlugin', 'defineNuxtRouteMiddleware'],
    objectDefinitions: {
      defineNuxtComponent: ['asyncData', 'setup'],
      defineNuxtPlugin: ['setup'],
      definePageMeta: ['middleware', 'validate'],
    },
  }
  const plugin = UnctxTransformPlugin({ sourcemap: false, transformerOptions }).raw({}, {} as any) as any
  return plugin.transformInclude(id) ? Promise.resolve(plugin.transform.handler(code)).then((r: any) => r?.code.replace(/^ {6}/gm, '').trim()) : null
}
