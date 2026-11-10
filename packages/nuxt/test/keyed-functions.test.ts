import type { KeyedFunction } from '@nuxt/schema'
import { describe, expect, it, vi } from 'vitest'
import { KeyedFunctionsPlugin } from '../src/compiler/plugins/keyed-functions'
import type { Import } from 'unimport'

type TransformHandler = (code: string, id: string) => Promise<{ code: string } | undefined>

function createTransform (options: Partial<Parameters<typeof KeyedFunctionsPlugin>[0]> & { keyedFunctions: KeyedFunction[] }) {
  const plugin = KeyedFunctionsPlugin({ alias: {}, getAutoImports: () => Promise.resolve([]), rootDir: '/', appDir: '/nuxt/dist/app/', requireSource: false, ...options }).raw({}, {} as any) as {
    transform: { filter: { code?: { include: RegExp } }, handler: TransformHandler }
  }
  const transform = async (code: string, id = 'plugin.ts') => (await plugin.transform.handler(code, id))?.code.trim()
  return Object.assign(transform, { filter: plugin.transform.filter })
}

describe('keyed functions plugin - reactive getter (dev mode)', () => {
  it('should pick up dynamically added keyed functions', async () => {
    const keyedFunctions: KeyedFunction[] = [
      { name: 'useExisting', source: '#app', argumentLength: 1 },
    ]
    const transform = createTransform({ keyedFunctions, getKeyedFunctions: () => keyedFunctions, dev: true })

    expect(await transform(`import { useExisting } from '#app'\nuseExisting()`)).toContain('/* nuxt-injected */')
    expect(await transform(`import { useExisting } from '#app'\nuseExisting()`, 'other.ts')).toContain('/* nuxt-injected */')

    const code = `import { useNewComposable } from '#app/composables/new'\nuseNewComposable()`
    expect(await transform(code)).toBeUndefined()

    keyedFunctions.push({ name: 'useNewComposable', source: '#app/composables/new', argumentLength: 1 })
    expect(await transform(code)).toContain('/* nuxt-injected */')
  })

  it('should use static code filter in production mode', () => {
    const keyedFunctions: KeyedFunction[] = [
      { name: 'useExisting', source: '#app', argumentLength: 1 },
    ]
    const transform = createTransform({ keyedFunctions, getKeyedFunctions: () => keyedFunctions, dev: false })
    expect(transform.filter.code!.include).toBeInstanceOf(RegExp)
  })
})

describe('keyed functions plugin', () => {
  const keyedFunctions: KeyedFunction[] = [
    { name: 'useKey', source: '#app', argumentLength: 1 },
    { name: 'useKey', source: '#app/useKeyTwo', argumentLength: 2 },
    { name: 'useKeyTwo', source: '#app', argumentLength: 2 },
    // duplicate entry
    { name: 'useKeyTwo', source: '#app', argumentLength: 2 },
    { name: 'useKeyTwoRenamed', source: 'renamed.ts', argumentLength: 2 },
    { name: 'default', source: '#app/defaultExport', argumentLength: 1 },
    { name: 'default', source: 'composables/use-default-key.ts', argumentLength: 1 },
    // TODO: remove entries without source in Nuxt 5
    // @ts-expect-error - `source` wasn't required before
    { name: 'useAutoImported', argumentLength: 1 },
    // @ts-expect-error - regex was supported before
    { name: 'useRegexKey', argumentLength: 1, source: /regex/ },
  ]

  const autoImports: Import[] = [
    { from: '#app', name: 'useAutoImported', as: 'useAutoImported' },
  ]

  const transform = createTransform({ keyedFunctions, getAutoImports: () => Promise.resolve(autoImports) })

  it.each([
    ['a key is already provided', 'plugin.ts', `
import { useKey, useKeyTwo } from '#app'
useKey('$existingKey')
useKeyTwo(() => {}, '$existingKey')`],
    ['non-matching function names', 'plugin.ts', `
import { useKeyThree } from '#app'
useKeyThree()`],
    ['non-exported matching functions in `source`', '#app', `
useKeyTwo()
const useKey = (arg1) => {}
useKey()
function useKeyTwo(arg1, arg2) {}`],
    // `useKey` is not exported under its own name, and `useRenamedKey` is not a keyed function
    ['matching functions in `source` renamed in export', '#app', `
function useRenamedKey(arg) {}
useKey()
useRenamedKey()
function useKey(arg) {}
export { useKey as useRenamedKey }`],
    ['default export in `source` without a keyed default', '#app', `
useKey()
function useKey(arg) {}
export default useKey`],
    ['anonymous default export in `source` without a keyed default', '#app', `
useKey()
export default function useKey(arg) {}`],
    ['imports from other sources', 'plugin.ts', `
import { useKey } from 'some-other-source'
import { useKeyTwo } from '#application' // deliberately using an alias starting with #app
useKey()
useKeyTwo()`],
    ['non-matching default import', 'plugin.ts', `
import useDefault from '#app'
useDefault()`],
    ['non-matching namespace import', 'plugin.ts', `
import * as other from 'some-other-source'
other.useKey()`],
    ['template literal access on a namespace', 'plugin.ts', `
import * as app from '#app'
app[\`useKey\`]()`],
    ['dynamic import', 'plugin.ts', `
const mod = await import('#app')
mod.useKey()`],
    ['destructured namespace', 'plugin.ts', `
import * as app from '#app'
const { useKey } = app
useKey()`],
    ['type-only imports', 'plugin.ts', `
import type { useKey } from '#app'
useKey()`],
    ['tagged templates', 'plugin.ts', `
import { useKeyTwo } from '#app'
useKeyTwo\`template string\``],
    ['`call` or `apply`', 'plugin.ts', `
import { useKeyTwo } from '#app'
useKeyTwo.call(this)
useKeyTwo.apply(this, [])`],
    ['deep property access', 'plugin.ts', `
import * as app from '#app'
const pkg = { app }
pkg.app.useKey()`],
    // webpack may process the same file more than once
    ['an already-injected key', 'plugin.ts', `
import { useKeyTwo } from '#app'
useKeyTwo('$HJiaryoL2y' /* nuxt-injected */)`],
  ])('should not add a key for %s', async (_, id, code) => {
    expect(await transform(code, id)).toBeUndefined()
  })

  it('should add hash when there is none already provided', async () => {
    expect(await transform(`
import { useKey, useKeyTwo } from '#app'
useKey()
useKeyTwo(() => {})
    `)).toMatchInlineSnapshot(`
      "import { useKey, useKeyTwo } from '#app'
      useKey('$HJiaryoL2y' /* nuxt-injected */)
      useKeyTwo(() => {}, '$yysMIARJHe' /* nuxt-injected */)"
    `)
  })

  it('should not treat script tags in a module string as an SFC script block', async () => {
    expect(await transform(`const html = '<script>0</script>'\nimport { useKey } from '#app'\nuseKey()`)).toContain(`useKey('$HJiaryoL2y' /* nuxt-injected */)`)
  })

  it('should use different hash for each call of the same function', async () => {
    expect(await transform(`
import { useKey } from '#app'
useKey()
useKey()
    `)).toMatchInlineSnapshot(`
      "import { useKey } from '#app'
      useKey('$HJiaryoL2y' /* nuxt-injected */)
      useKey('$yysMIARJHe' /* nuxt-injected */)"
    `)
  })

  it('should add hash to functions from default imports', async () => {
    expect(await transform(`
import useDefaultKey from 'composables/use-default-key.ts'
import useRenamedFunctionThatIsNotInKeyedFunctions from 'composables/use-default-key.ts'
import useDefault from '#app/defaultExport'
import { default as useRenamedDefault } from '#app/defaultExport'
useDefaultKey()
useRenamedFunctionThatIsNotInKeyedFunctions()
useDefault()
useRenamedDefault()`)).toMatchInlineSnapshot(`
      "import useDefaultKey from 'composables/use-default-key.ts'
      import useRenamedFunctionThatIsNotInKeyedFunctions from 'composables/use-default-key.ts'
      import useDefault from '#app/defaultExport'
      import { default as useRenamedDefault } from '#app/defaultExport'
      useDefaultKey('$HJiaryoL2y' /* nuxt-injected */)
      useRenamedFunctionThatIsNotInKeyedFunctions('$yysMIARJHe' /* nuxt-injected */)
      useDefault('$Cy7hQH5X5O' /* nuxt-injected */)
      useRenamedDefault('$Fl_F5LB-IM' /* nuxt-injected */)"
    `)
  })

  it('should correctly identify same-name functions from different sources', async () => {
    expect(await transform(`
import { useKey as useKeyOne } from '#app'
import { useKey as useKeyTwo } from '#app/useKeyTwo'
import { useKey as useOtherKey } from 'some-other-source'
import { useKeyTwo as shouldNotAddHash } from './somewhere-else'
useKeyOne()
useKeyTwo('first')
useOtherKey()
shouldNotAddHash()
    `)).toMatchInlineSnapshot(`
      "import { useKey as useKeyOne } from '#app'
      import { useKey as useKeyTwo } from '#app/useKeyTwo'
      import { useKey as useOtherKey } from 'some-other-source'
      import { useKeyTwo as shouldNotAddHash } from './somewhere-else'
      useKeyOne('$HJiaryoL2y' /* nuxt-injected */)
      useKeyTwo('first', '$yysMIARJHe' /* nuxt-injected */)
      useOtherKey()
      shouldNotAddHash()"
    `)
  })

  it('should warn if there are duplicate entries in keyed functions', () => {
    vi.stubGlobal('__TEST_DEV__', true)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    createTransform({ keyedFunctions })

    expect(warn).toHaveBeenCalledWith(expect.stringMatching(
      /Duplicate keyed function name `useKeyTwo`.* with the same source `#app` found\. Overwriting the existing entry\./,
    ))
    warn.mockRestore()
    vi.unstubAllGlobals()
  })

  it('should handle multi-line parameters and trailing commas', async () => {
    expect(await transform(`
import { useKey, useKeyTwo } from '#app'
useKey(
)
useKeyTwo(


  () => {}
)

useKeyTwo(
  () => {
  })

useKeyTwo(
  () => {},
)

useKeyTwo(
  () => {}
  ,)
    `)).toMatchInlineSnapshot(`
      "import { useKey, useKeyTwo } from '#app'
      useKey(
      '$HJiaryoL2y' /* nuxt-injected */)
      useKeyTwo(


        () => {}
      , '$yysMIARJHe' /* nuxt-injected */)

      useKeyTwo(
        () => {
        }, '$Cy7hQH5X5O' /* nuxt-injected */)

      useKeyTwo(
        () => {},
      '$Fl_F5LB-IM' /* nuxt-injected */)

      useKeyTwo(
        () => {}
        ,'$1GDT7saTf0' /* nuxt-injected */)"
    `)
  })

  it('should respect scopes and shadowing', async () => {
    expect(await transform(`
import { useKey } from '#app'
function foo() {
  useKey()
  if (true) {
    useKey()
  }
}
function bar() {
  useKey()
  function useKey() { return 'local' }
}
function baz() {
  const useKey = () => 'local'
  useKey()
}
function qux(useKey) {
  useKey()
}
const quux = useKey => useKey()
    `)).toMatchInlineSnapshot(`
      "import { useKey } from '#app'
      function foo() {
        useKey('$HJiaryoL2y' /* nuxt-injected */)
        if (true) {
          useKey('$yysMIARJHe' /* nuxt-injected */)
        }
      }
      function bar() {
        useKey()
        function useKey() { return 'local' }
      }
      function baz() {
        const useKey = () => 'local'
        useKey()
      }
      function qux(useKey) {
        useKey()
      }
      const quux = useKey => useKey()"
    `)
  })

  it('should add hash when processing file in `source` for exported functions', async () => {
    expect(await transform(`
useKeyTwo()
export const useKey = (arg1) => {}
useKey()
export function useKeyTwo(arg1, arg2) {}
    `, '#app')).toMatchInlineSnapshot(`
      "useKeyTwo('$QQV3F06xQZ' /* nuxt-injected */)
      export const useKey = (arg1) => {}
      useKey('$Bil3ev-zNC' /* nuxt-injected */)
      export function useKeyTwo(arg1, arg2) {}"
    `)
  })

  it('should handle standalone export declaration and shadowing in `source`', async () => {
    expect(await transform(`
useKey()
function useKey(arg) {}
function foo() {
  useKey()
  function useKey() { return 'local' }
}
function bar() {
  const useKey = () => 'local'
  useKey()
}
useKey()
export { useKey }
    `, '#app')).toMatchInlineSnapshot(`
      "useKey('$QQV3F06xQZ' /* nuxt-injected */)
      function useKey(arg) {}
      function foo() {
        useKey()
        function useKey() { return 'local' }
      }
      function bar() {
        const useKey = () => 'local'
        useKey()
      }
      useKey('$Bil3ev-zNC' /* nuxt-injected */)
      export { useKey }"
    `)
  })

  it('should add hash to original function in `source` when renamed in export', async () => {
    expect(await transform(`
foo()
function foo(arg) {}
function bar() {
  const foo = () => 'local'
  foo()
}
foo()
export { foo as useKey }
    `, '#app')).toMatchInlineSnapshot(`
      "foo('$QQV3F06xQZ' /* nuxt-injected */)
      function foo(arg) {}
      function bar() {
        const foo = () => 'local'
        foo()
      }
      foo('$Bil3ev-zNC' /* nuxt-injected */)
      export { foo as useKey }"
    `)
  })

  it('should add hash to imported keyed function in `source` when renamed in export', async () => {
    expect(await transform(`
import { useKey } from '#app'
useKey('add-key-after')
export { useKey as useKeyTwoRenamed }
    `, 'renamed.ts')).toMatchInlineSnapshot(`
      "import { useKey } from '#app'
      useKey('add-key-after', '$Ja9NP0cDY0' /* nuxt-injected */)
      export { useKey as useKeyTwoRenamed }"
    `)
  })

  it.each([
    `useFoo()\nfunction useFoo(arg) {}\nexport default useFoo`,
    `const useFoo = (arg) => {}\nuseFoo()\nexport default useFoo`,
    `useFoo()\nexport default function useFoo(arg) {}`,
  ])('should handle default export in `source`: %s', async (code) => {
    expect(await transform(code, '#app/defaultExport')).toBe(code.replace('useFoo()', `useFoo('$gvnasIOzix' /* nuxt-injected */)`))
  })

  it('should add hash for namespace imports', async () => {
    expect(await transform(`
import * as app from '#app'
app.useKey()
app['useKey']()
useKey()
const keyName = 'useKey'
app[keyName]()
app['use' + 'Key']()
function foo() {
  const app = { useKey: () => 'local' }
  app.useKey()
}
    `)).toMatchInlineSnapshot(`
      "import * as app from '#app'
      app.useKey('$HJiaryoL2y' /* nuxt-injected */)
      app['useKey']('$yysMIARJHe' /* nuxt-injected */)
      useKey()
      const keyName = 'useKey'
      app[keyName]()
      app['use' + 'Key']()
      function foo() {
        const app = { useKey: () => 'local' }
        app.useKey()
      }"
    `)
  })

  it('should handle mixed imports', async () => {
    expect(await transform(`
import useDefault, { useKey as useRenamedKey, useKeyTwo } from '#app'
import useDefaultKey from '#app/defaultExport'
useDefault()
useDefaultKey()
useRenamedKey()
useKeyTwo(() => {})
    `)).toMatchInlineSnapshot(`
      "import useDefault, { useKey as useRenamedKey, useKeyTwo } from '#app'
      import useDefaultKey from '#app/defaultExport'
      useDefault()
      useDefaultKey('$HJiaryoL2y' /* nuxt-injected */)
      useRenamedKey('$yysMIARJHe' /* nuxt-injected */)
      useKeyTwo(() => {}, '$Cy7hQH5X5O' /* nuxt-injected */)"
    `)
  })

  it('should only add keys to direct calls', async () => {
    expect(await transform(`
import { useKey, useKeyTwo } from '#app'
(Math.random() > 0.5 ? useKey : () => {})()
Math.random() > 0.5 ? useKey() : null
useKey(...args)
useKeyTwo(...args)
    `)).toMatchInlineSnapshot(`
      "import { useKey, useKeyTwo } from '#app'
      (Math.random() > 0.5 ? useKey : () => {})()
      Math.random() > 0.5 ? useKey('$HJiaryoL2y' /* nuxt-injected */) : null
      useKey(...args, '$yysMIARJHe' /* nuxt-injected */)
      useKeyTwo(...args, '$Cy7hQH5X5O' /* nuxt-injected */)"
    `)
  })

  it('should inject keys for auto-imported functions', async () => {
    expect(await transform(`
    import { useAutoImported } from '#app'
    useAutoImported()
    `)).toMatchInlineSnapshot(`
      "import { useAutoImported } from '#app'
          useAutoImported('$HJiaryoL2y' /* nuxt-injected */)"
    `)
  })

  it('should inject keys for regex-matched function sources', async () => {
    expect(await transform(`
    import { useRegexKey } from 'some-regex-matched-source'
    useRegexKey()
    `)).toMatchInlineSnapshot(`
      "import { useRegexKey } from 'some-regex-matched-source'
          useRegexKey('$HJiaryoL2y' /* nuxt-injected */)"
    `)
  })

  describe('with `requireSource`', () => {
    const strictTransform = createTransform({ keyedFunctions, getAutoImports: () => Promise.resolve(autoImports), requireSource: true })

    it('should still inject keys for functions with a matching source', async () => {
      expect(await strictTransform(`import { useKey } from '#app'\nuseKey()`)).toContain('/* nuxt-injected */')
    })

    it.each([
      ['auto-imported functions without a source', `import { useAutoImported } from '#app'\nuseAutoImported()`],
      ['regex-matched function sources', `import { useRegexKey } from 'some-regex-matched-source'\nuseRegexKey()`],
    ])('should not inject keys for %s', async (_, code) => {
      expect(await strictTransform(code)).toBeUndefined()
    })
  })
})

describe('core keyed functions', () => {
  // these entries must match those in `packages/schema/src/config/build.ts`, as some values are
  // hard-coded in the plugin implementation
  const transform = createTransform({
    keyedFunctions: [
      { name: 'callOnce', argumentLength: 3, source: '#app/composables/once' },
      { name: 'defineNuxtComponent', argumentLength: 2, source: '#app/composables/component' },
      { name: 'useState', argumentLength: 2, source: '#app/composables/state' },
      { name: 'useFetch', argumentLength: 3, source: '#app/composables/fetch' },
      { name: 'useAsyncData', argumentLength: 3, source: '#app/composables/asyncData' },
      { name: 'useLazyAsyncData', argumentLength: 3, source: '#app/composables/asyncData' },
      { name: 'useLazyFetch', argumentLength: 3, source: '#app/composables/fetch' },
    ],
  })

  it.each([
    ['string keys', `
import { useState } from '#app/composables/state'
useState('stringKey')
useState(\`templateStringKey\`)
useState(\`template\${dynamic}StringKey\`)
useState("doubleQuotedStringKey")
useState('$existingKey', () => 1)`],
    ['`useAsyncData` with a key as the first argument', `
import { useAsyncData, useLazyAsyncData } from '#app/composables/asyncData'
useAsyncData('key', () => $fetch('/api/data'))
useAsyncData('key', () => $fetch('/api/data'), { server: false })
useLazyAsyncData('key', () => $fetch('/api/data'))
useLazyAsyncData('key', () => $fetch('/api/data'), { server: false })`],
  ])('should not add a key for %s', async (_, code) => {
    expect(await transform(code)).toBeUndefined()
  })

  it('should add a key when it cannot be determined statically', async () => {
    expect(await transform(`
import { useState } from '#app/composables/state'
useState('some' + 'key')
useState(someVariable)
useState(getKey())
useState(obj.prop)
useState(obj['prop'])
useState(obj.met())
useState(() => 1)
    `)).toMatchInlineSnapshot(`
      "import { useState } from '#app/composables/state'
      useState('some' + 'key', '$HJiaryoL2y' /* nuxt-injected */)
      useState(someVariable, '$yysMIARJHe' /* nuxt-injected */)
      useState(getKey(), '$Cy7hQH5X5O' /* nuxt-injected */)
      useState(obj.prop, '$Fl_F5LB-IM' /* nuxt-injected */)
      useState(obj['prop'], '$1GDT7saTf0' /* nuxt-injected */)
      useState(obj.met(), '$8YFL1gGJy8' /* nuxt-injected */)
      useState(() => 1, '$-6Jq0e1X0N' /* nuxt-injected */)"
    `)
  })

  it('should always add a key to `useFetch`', async () => {
    expect(await transform(`
import { useFetch, useLazyFetch } from '#app/composables/fetch'
useFetch('/api/data')
useFetch(() => '/api/data')
useFetch(url, options)
useLazyFetch('/api/data', { method: 'POST' })
    `)).toMatchInlineSnapshot(`
      "import { useFetch, useLazyFetch } from '#app/composables/fetch'
      useFetch('/api/data', '$HJiaryoL2y' /* nuxt-injected */)
      useFetch(() => '/api/data', '$yysMIARJHe' /* nuxt-injected */)
      useFetch(url, options, '$Cy7hQH5X5O' /* nuxt-injected */)
      useLazyFetch('/api/data', { method: 'POST' }, '$Fl_F5LB-IM' /* nuxt-injected */)"
    `)
  })

  it('should add a key to `useAsyncData` without one', async () => {
    expect(await transform(`
import { useAsyncData } from '#app/composables/asyncData'
useAsyncData(() => $fetch('/api/data'))
useAsyncData(() => $fetch('/api/data'), { server: false })
    `)).toMatchInlineSnapshot(`
      "import { useAsyncData } from '#app/composables/asyncData'
      useAsyncData(() => $fetch('/api/data'), '$HJiaryoL2y' /* nuxt-injected */)
      useAsyncData(() => $fetch('/api/data'), { server: false }, '$yysMIARJHe' /* nuxt-injected */)"
    `)
  })
})

describe('keyed functions plugin - project location', () => {
  async function getKey (rootDir: string, id: string) {
    const transform = createTransform({
      keyedFunctions: [{ name: 'useAsyncData', argumentLength: 3, source: '/nuxt/dist/app/composables/asyncData' }],
      alias: { '#app': '/nuxt/dist/app' },
      rootDir,
    })
    const code = await transform(`import { useAsyncData } from '#app/composables/asyncData'\nuseAsyncData(() => $fetch('/api/data'))`, id)
    const key = code?.match(/'(\$\S+)' \/\* nuxt-injected \*\//)?.[1]
    expect(key).toBeDefined()
    return key
  }

  it('should generate the same key when the project is built from another directory', async () => {
    for (const file of ['project/app/pages/index.vue', 'layer/app/pages/index.vue']) {
      expect(await getKey('/home/runner/work/project', `/home/runner/work/${file}`)).toBe(await getKey('/builds/project', `/builds/${file}`))
    }
  })

  it('should generate different keys for different files', async () => {
    expect(await getKey('/builds/project', '/builds/project/app/pages/index.vue')).not.toBe(await getKey('/builds/project', '/builds/layer/app/pages/index.vue'))
  })
})
