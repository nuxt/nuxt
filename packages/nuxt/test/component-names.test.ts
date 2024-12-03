import { describe, expect, it } from 'vitest'
import type { Component } from '@nuxt/schema'
import { compileScript, parse } from '@vue/compiler-sfc'
import * as Parser from 'acorn'

import { ComponentNamePlugin } from '../src/components/plugins/component-names'

describe('component names', () => {
  const components = [{
    filePath: 'test.ts',
    pascalName: 'TestMe',
  }] as [Component]

  const transformPlugin = ComponentNamePlugin({ sourcemap: false, getComponents: () => components }).raw({}, {} as any) as { transform: (code: string, id: string) => { code: string } | null }

  it('should add correct default component names', () => {
    const sfc = `
<script setup>
onMounted(() => {
  window.a = 32
})
</script>
    `
    const res = compileScript(parse(sfc).descriptor, { id: 'test.vue' })
    const { code } = transformPlugin.transform.call({
      parse: (code: string, opts: any = {}) => Parser.parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        locations: true,
        ...opts,
      }),
    }, res.content, components[0].filePath) ?? {}
    expect(code?.trim()).toMatchInlineSnapshot(`
      "export default Object.assign({
        setup(__props, { expose: __expose }) {
        __expose();

      onMounted(() => {
        window.a = 32
      })

      const __returned__ = {  }
      Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true })
      return __returned__
      }

      }, { __name: "TestMe" })"
    `)
  })
})
