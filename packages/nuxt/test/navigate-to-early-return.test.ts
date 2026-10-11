import { afterEach, describe, expect, it } from 'vitest'
import { compileScript, parse } from '@vue/compiler-sfc'
import { createSSRApp, defineComponent } from 'vue'
import { renderToString, ssrInterpolate } from 'vue/server-renderer'
import { NavigateToEarlyReturnPlugin } from '../src/core/plugins/navigate-to.ts'
import { _navigateToEarlyReturn } from '../src/app/composables/router.ts'

const plugin = NavigateToEarlyReturnPlugin().raw({}, { framework: 'vite', versions: {} }) as {
  transform: { handler: (code: string, id: string) => { code: string } | null | undefined }
}

function compileSFC (source: string, { inlineTemplate = false } = {}) {
  const { descriptor } = parse(source, { filename: 'app.vue' })
  return compileScript(descriptor, { id: 'app.vue', inlineTemplate }).content
}

async function transform (source: string, id = 'app.vue') {
  const result = await plugin.transform.handler(compileSFC(source), id)
  return typeof result === 'string' ? result : result?.code
}

describe('navigateTo early return transform', () => {
  it('transforms top-level `await navigateTo()` into an early return', async () => {
    const result = await transform(`
<template><div>{{ a }}</div></template>
<script setup>
const a = 1
await navigateTo('/a')
await navigateTo('/b')
</script>
`)
    expect(result).toContain('return __nuxt_navigate_to_early_return()')
    expect(result?.match(/return __nuxt_navigate_to_early_return\(\)/g)).toHaveLength(2)
    expect(result).toMatchInlineSnapshot(`
      "import { _navigateToEarlyReturn as __nuxt_navigate_to_early_return } from '#app/composables/router';
      import { withAsyncContext as _withAsyncContext } from 'vue'
      const a = 1

      export default {
        __name: 'app',
        async setup(__props, { expose: __expose }) {
        __expose();

      let __temp, __restore

      ;{ if (((
        ([__temp,__restore] = _withAsyncContext(() => navigateTo('/a'))),
        __temp = await __temp,
        __restore()
      )
      , __temp) === undefined) return __nuxt_navigate_to_early_return(); }{ if (((
        ([__temp,__restore] = _withAsyncContext(() => navigateTo('/b'))),
        __temp = await __temp,
        __restore()
      ), __temp) === undefined) return __nuxt_navigate_to_early_return() }

      const __returned__ = { a }
      Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true })
      return __returned__
      }

      }"
    `)
  })

  it('transforms `await navigateTo()` within a conditional block', async () => {
    const result = await transform(`
<template><div /></template>
<script setup>
const a = 1
if (a) {
  await navigateTo('/a', { replace: true })
}
</script>
`)
    expect(result).toContain('return __nuxt_navigate_to_early_return()')
    expect(result).toMatchInlineSnapshot(`
      "import { _navigateToEarlyReturn as __nuxt_navigate_to_early_return } from '#app/composables/router';
      import { withAsyncContext as _withAsyncContext } from 'vue'
      const a = 1

      export default {
        __name: 'app',
        async setup(__props, { expose: __expose }) {
        __expose();

      let __temp, __restore

      if (a) {
        { if (((
        ([__temp,__restore] = _withAsyncContext(() => navigateTo('/a', { replace: true }))),
        __temp = await __temp,
        __restore()
      ), __temp) === undefined) return __nuxt_navigate_to_early_return() }
      }

      const __returned__ = { a }
      Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true })
      return __returned__
      }

      }"
    `)
  })

  it('transforms `await navigateTo()` in an unbraced conditional', async () => {
    const result = await transform(`
<template><div /></template>
<script setup>
const a = 1
if (a) await navigateTo('/a')
</script>
`)
    expect(result).toContain('return __nuxt_navigate_to_early_return()')
    expect(result).toMatchInlineSnapshot(`
      "import { _navigateToEarlyReturn as __nuxt_navigate_to_early_return } from '#app/composables/router';
      import { withAsyncContext as _withAsyncContext } from 'vue'
      const a = 1

      export default {
        __name: 'app',
        async setup(__props, { expose: __expose }) {
        __expose();

      let __temp, __restore

      if (a) { if (((
        ([__temp,__restore] = _withAsyncContext(() => navigateTo('/a'))),
        __temp = await __temp,
        __restore()
      ), __temp) === undefined) return __nuxt_navigate_to_early_return() }

      const __returned__ = { a }
      Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true })
      return __returned__
      }

      }"
    `)
  })

  it('does not rebind `else` in an unbraced conditional', async () => {
    const result = await transform(`
<template><div /></template>
<script setup>
const a = 1
if (a) await navigateTo('/a')
else console.log('else branch')
</script>
`)
    expect(result).toContain('return __nuxt_navigate_to_early_return()')
    expect(result).toMatchInlineSnapshot(`
      "import { _navigateToEarlyReturn as __nuxt_navigate_to_early_return } from '#app/composables/router';
      import { withAsyncContext as _withAsyncContext } from 'vue'
      const a = 1

      export default {
        __name: 'app',
        async setup(__props, { expose: __expose }) {
        __expose();

      let __temp, __restore

      if (a) { if (((
        ([__temp,__restore] = _withAsyncContext(() => navigateTo('/a'))),
        __temp = await __temp,
        __restore()
      ), __temp) === undefined) return __nuxt_navigate_to_early_return() }
      else console.log('else branch')

      const __returned__ = { a }
      Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true })
      return __returned__
      }

      }"
    `)
  })

  it('does not transform when the result is used', async () => {
    const result = await transform(`
<template><div /></template>
<script setup>
const x = await navigateTo('/a')
</script>
`)
    expect(result).toBeUndefined()
  })

  it('does not transform when `open` option is used', async () => {
    const result = await transform(`
<template><div /></template>
<script setup>
await navigateTo('/a', { open: { target: '_blank' } })
</script>
`)
    expect(result).toBeUndefined()
  })

  it('does not transform when options cannot be statically analysed', async () => {
    const result = await transform(`
<template><div /></template>
<script setup>
const opts = { replace: true }
await navigateTo('/a', opts)
</script>
`)
    expect(result).toBeUndefined()
  })

  it('does not transform a locally declared `navigateTo`', async () => {
    const result = await transform(`
<template><div /></template>
<script setup>
function navigateTo (to) { return Promise.resolve(to) }
await navigateTo('/a')
</script>
`)
    expect(result).toBeUndefined()
  })

  it('does not transform `navigateTo` imported from another module', async () => {
    const result = await transform(`
<template><div /></template>
<script setup>
import { navigateTo } from 'some-library'
await navigateTo('/a')
</script>
`)
    expect(result).toBeUndefined()
  })

  it('transforms `navigateTo` explicitly imported from nuxt', async () => {
    const result = await transform(`
<template><div /></template>
<script setup>
import { navigateTo } from '#app'
await navigateTo('/a')
</script>
`)
    expect(result).toContain('return __nuxt_navigate_to_early_return()')
  })

  it('does not transform a `setup` method on an object created inside a function', async () => {
    const result = await transform(`
<template><div /></template>
<script>
export function createThing () {
  return {
    async setup () {
      let __temp, __restore
      ;(
        ([__temp,__restore] = _withAsyncContext(() => navigateTo('/'))),
        await __temp,
        __restore()
      )
    },
  }
}
</script>
<script setup>
const a = 1
</script>
`)
    expect(result).toBeUndefined()
  })

  it('does not transform calls within nested functions', async () => {
    const result = await transform(`
<template><div /></template>
<script setup>
await Promise.resolve()
async function redirect () {
  await navigateTo('/a')
}
</script>
`)
    expect(result).toBeUndefined()
  })

  it('transforms inline (production) compiler output', async () => {
    const source = `
<template><div /></template>
<script setup>
await navigateTo('/a')
</script>
`
    const result = await plugin.transform.handler(compileSFC(source, { inlineTemplate: true }), 'app.vue')
    const code = typeof result === 'string' ? result : result?.code
    expect(code).toContain('return __nuxt_navigate_to_early_return()')
    expect(code).toMatchInlineSnapshot(`
      "import { _navigateToEarlyReturn as __nuxt_navigate_to_early_return } from '#app/composables/router';
      import { withAsyncContext as _withAsyncContext } from 'vue'
      import { openBlock as _openBlock, createElementBlock as _createElementBlock } from "vue"


      export default {
        __name: 'app',
        async setup(__props) {

      let __temp, __restore

      ;{ if (((
        ([__temp,__restore] = _withAsyncContext(() => navigateTo('/a'))),
        __temp = await __temp,
        __restore()
      ), __temp) === undefined) return __nuxt_navigate_to_early_return() }

      return (_ctx, _cache) => {
        return (_openBlock(), _createElementBlock("div"))
      }
      }

      }"
    `)
  })
})

describe('navigateTo early return runtime helper', () => {
  afterEach(() => {
    // @ts-expect-error not typed on globalThis
    globalThis.__TEST_SERVER__ = false
  })

  it('returns a render function that renders null on the client', () => {
    const render = _navigateToEarlyReturn()
    expect(render(undefined, [])).toBeNull()
  })

  it('pushes a placeholder when called as an inline ssrRender', () => {
    const render = _navigateToEarlyReturn()
    const pushed: string[] = []
    expect(render(undefined, (s: string) => pushed.push(s))).toBeUndefined()
    expect(pushed).toEqual(['<!---->'])
  })

  it('bypasses the compiled ssrRender on the server', async () => {
    // @ts-expect-error not typed on globalThis
    globalThis.__TEST_SERVER__ = true

    const Comp = defineComponent({
      setup () {
        return Promise.resolve(_navigateToEarlyReturn())
      },
      ssrRender (_ctx: { a: { b: string } }, push: (s: string) => void) {
        push(`<div>${ssrInterpolate(_ctx.a.b)}</div>`)
      },
    })

    await expect(renderToString(createSSRApp(Comp))).resolves.toBe('<!---->')
  })
})
