import { describe, expect, it } from 'vitest'

import { TreeShakeComposablesPlugin } from '../src/core/plugins/tree-shake'

describe('tree-shake', () => {
  const transformPlugin: any = TreeShakeComposablesPlugin({
    sourcemap: false,
    composables: { 'vue': ['onMounted', 'onUnmounted'] },
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

  it('should not tree-shake composables within other composables', () => {
    const code = `
    import { onUnmounted, onMounted } from '#imports'
     onMounted(() => {
       onUnmounted(() => {})
     })

     onMounted(() => {
       console.log('Hello World')
     })
    `

    const { code: result } = transformPlugin.transform.handler(code, 'test.js')
    expect(clean(result)).toMatchInlineSnapshot(`
      "import { onUnmounted, onMounted } from '#imports'
        false && /*@__PURE__*/ onMounted(() => {
         onUnmounted(() => {})
       })
        false && /*@__PURE__*/ onMounted(() => {
         console.log('Hello World')
       })"
    `)
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
         false && /*@__PURE__*/ onMounted()
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
})

function clean (string?: string) {
  const lines = string?.split('\n').filter(l => l.trim()) || []
  const indent = lines.reduce((prev, curr) => {
    const length = curr.match(/^\s+/)?.[0].length ?? 0
    return length < prev ? length : prev
  }, Infinity)

  const re = new RegExp(`^\\s{${indent}}`)
  return lines.map(l => l.replace(re, '')).join('\n')
}
