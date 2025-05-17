import { describe, expect, it } from 'vitest'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'
import type { Nuxt } from '@nuxt/schema'
import { RouteInjectionPlugin } from '../src/pages/plugins/route-injection'

describe('route-injection:transform', () => {
  const injectionPlugin = RouteInjectionPlugin({ options: { sourcemap: { client: false, server: false } } } as Nuxt).raw({}, { framework: 'rollup' }) as { transform: { handler: (code: string, id: string) => { code: string } | null } }

  const transform = async (source: string) => {
    const result = await injectionPlugin.transform.handler.call({ error: null, warn: null } as any, source, 'test.vue')
    const code: string = typeof result === 'string' ? result : result!.code
    let depth = 0
    return code.split('\n').map((l) => {
      l = l.trim()
      if (l.match(/^[}\]]/)) { depth-- }
      const res = ''.padStart(depth * 2, ' ') + l
      if (l.match(/[{[]$/)) { depth++ }
      return res
    }).join('\n')
  }

  it('should correctly inject route in template', async () => {
    const sfc = `<template>{{ $route.path }}</template>`
    const res = compileTemplate({
      filename: 'test.vue',
      id: 'test.vue',
      source: sfc,
    })
    const transformResult = await transform(res.code)
    expect(transformResult).toMatchInlineSnapshot(`
      "import { PageRouteSymbol as __nuxt_route_symbol } from '#app/components/injections';
      import { toDisplayString as _toDisplayString, createTextVNode as _createTextVNode, openBlock as _openBlock, createElementBlock as _createElementBlock } from "vue"

      export function render(_ctx, _cache) {
        return (_openBlock(), _createElementBlock("template", null, [
          _createTextVNode(_toDisplayString((_ctx._.provides[__nuxt_route_symbol] || _ctx.$route).path), 1 /* TEXT */)
        ]))
      }"
    `)
  })

  it('should correctly inject route in options api', async () => {
    const sfc = `
      <template>{{ thing }}</template>
      <script>
      export default {
        computed: {
          thing () {
            return this.$route.path
          }
        }
      }
      </script>
    `

    const res = compileScript(parse(sfc).descriptor, { id: 'test.vue' })
    const transformResult = await transform(res.content)
    expect(transformResult).toMatchInlineSnapshot(`
      "import { PageRouteSymbol as __nuxt_route_symbol } from '#app/components/injections';

      export default {
        computed: {
          thing () {
            return (this._.provides[__nuxt_route_symbol] || this.$route).path
          }
        }
      }
      "
    `)
  })
})
