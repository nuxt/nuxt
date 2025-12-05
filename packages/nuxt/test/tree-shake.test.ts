import { describe, expect, it } from 'vitest'

import { TreeShakeComposablesPlugin } from '../src/core/plugins/tree-shake'
import { clean } from './utils'

describe('tree-shake', () => {
  const transformPlugin: any = TreeShakeComposablesPlugin({
    sourcemap: false,
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
