import { describe, expect, it } from 'vitest'
import type { Component } from '@nuxt/schema'
import { compileScript, parse } from '@vue/compiler-sfc'

import { ComponentNamePlugin } from '../src/components/plugins/component-names.ts'

describe('component names', () => {
  const components = [
    {
      filePath: 'test.ts',
      pascalName: 'TestMe',
    },
    {
      filePath: 'test.vue',
      pascalName: 'TestMe',
    },
  ] as [Component, Component]

  const transformPlugin = ComponentNamePlugin({ getComponents: () => components }).raw({}, {} as any) as { transform: { handler: (code: string, id: string) => { code: string } | null } }

  it('should ignore files that are not components ', () => {
    const res = transformPlugin.transform.handler('export default {}', 'some-other-file.ts')
    expect(res?.code).toBeUndefined()
  })

  it('should process simple default exports', () => {
    const res = transformPlugin.transform.handler('export default {}', 'test.vue')
    expect(res?.code).toMatchInlineSnapshot(`"export default Object.assign({}, { __name: "TestMe" })"`)
  })

  it('should add correct default component names', () => {
    const sfc = `
<script setup>
onMounted(() => {
  window.a = 32
})
</script>
    `
    const res = compileScript(parse(sfc).descriptor, { id: 'test.vue' })
    const { code } = transformPlugin.transform.handler(res.content, components[0].filePath) ?? {}
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

  it('should use first matches and refresh after scans or length changes', () => {
    let current: Component[] = components
    const plugin = ComponentNamePlugin({ getComponents: () => current }).raw({}, {} as any) as typeof transformPlugin
    expect(plugin.transform.handler('export default {}', 'test.vue')?.code).toContain('"TestMe"')

    current = [
      { ...components[1], pascalName: 'First' },
      { ...components[1], pascalName: 'Second' },
    ]
    expect(plugin.transform.handler('export default {}', 'test.vue')?.code).toContain('"First"')
    expect(plugin.transform.handler('export default {}', 'test.ts')?.code).toBeUndefined()

    current.push(components[0])
    expect(plugin.transform.handler('export default {}', 'test.ts')?.code).toContain('"TestMe"')
  })
})
