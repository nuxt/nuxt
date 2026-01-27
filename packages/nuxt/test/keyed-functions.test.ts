import type { KeyedFunction } from '@nuxt/schema'
import { describe, expect, it, vi } from 'vitest'
import { KeyedFunctionsPlugin } from '../src/core/plugins/keyed-functions'
import { logger } from '../src/utils'
import type { Import } from 'unimport'

describe('keyed functions plugin', () => {
  const keyedFunctions: KeyedFunction[] = [
    {
      name: 'useKey',
      source: '#app',
      argumentLength: 1,
    },
    {
      name: 'useKey',
      source: '#app/useKeyTwo',
      argumentLength: 2,
    },
    {
      name: 'useKeyTwo',
      source: '#app',
      argumentLength: 2,
    },
    {
      name: 'useKeyTwo', // duplicate entry
      source: '#app',
      argumentLength: 2,
    },
    {
      name: 'useKeyTwoRenamed',
      source: 'renamed.ts',
      argumentLength: 2,
    },
    {
      name: 'default',
      source: '#app/defaultExport',
      argumentLength: 1,
    },
    {
      name: 'default',
      source: 'composables/use-default-key.ts',
      argumentLength: 1,
    },
    // TODO: remove entries without source in Nuxt 5
    // @ts-expect-error - `source` wasn't required before
    {
      name: 'useAutoImported',
      argumentLength: 1,
    },
    {
      name: 'useRegexKey',
      argumentLength: 1,
      // @ts-expect-error - regex was supported before
      source: /regex/,
    },
  ]

  const autoImports: Import[] = [
    {
      from: '#app',
      name: 'useAutoImported',
      as: 'useAutoImported',
    },
  ]

  const transformPlugin = KeyedFunctionsPlugin({ sourcemap: false, keyedFunctions, alias: {}, getAutoImports: () => Promise.resolve(autoImports) }).raw({}, {} as any) as { transform: { handler: (code: string, id: string) => Promise<{ code: string } | null> } }

  it('should add hash when there is none already provided', async () => {
    const code = `
import { useKey, useKeyTwo } from '#app'
useKey()
useKeyTwo(() => {})
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useKey, useKeyTwo } from '#app'
      useKey('$HJiaryoL2y' /* nuxt-injected */)
      useKeyTwo(() => {}, '$yysMIARJHe' /* nuxt-injected */)"
    `)
  })

  it('should use different hash for each call of the same function', async () => {
    const code = `
import { useKey } from '#app'
useKey()
useKey()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useKey } from '#app'
      useKey('$HJiaryoL2y' /* nuxt-injected */)
      useKey('$yysMIARJHe' /* nuxt-injected */)"
    `)
  })

  it('should not add hash when one exists', async () => {
    const code = `
import { useKey, useKeyTwo } from '#app'
useKey('$existingKey')
useKeyTwo(() => {}, '$existingKey')
`
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should add add hash to function from default import', async () => {
    const code = `
import useDefaultKey from 'composables/use-default-key.ts'
useDefaultKey()`
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import useDefaultKey from 'composables/use-default-key.ts'
      useDefaultKey('$HJiaryoL2y' /* nuxt-injected */)"
    `)
  })

  it('should add hash to function from default import with different name', async () => {
    const code = `
    import useRenamedFunctionThatIsNotInKeyedFunctions from 'composables/use-default-key.ts'
    useRenamedFunctionThatIsNotInKeyedFunctions()`
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import useRenamedFunctionThatIsNotInKeyedFunctions from 'composables/use-default-key.ts'
          useRenamedFunctionThatIsNotInKeyedFunctions('$HJiaryoL2y' /* nuxt-injected */)"
    `)
  })

  it('should add hash to function from default import when renamed', async () => {
    const code = `
import { default as useRenamedDefault } from '#app/defaultExport'
useRenamedDefault()`
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { default as useRenamedDefault } from '#app/defaultExport'
      useRenamedDefault('$HJiaryoL2y' /* nuxt-injected */)"
    `)
  })

  it('should correctly identify same-name functions from different sources', async () => {
    const code = `
    import { useKey as useKeyOne } from '#app'
    import { useKey as useKeyTwo } from '#app/useKeyTwo'
    useKeyOne()
    useKeyTwo('first')
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useKey as useKeyOne } from '#app'
          import { useKey as useKeyTwo } from '#app/useKeyTwo'
          useKeyOne('$HJiaryoL2y' /* nuxt-injected */)
          useKeyTwo('first', '$yysMIARJHe' /* nuxt-injected */)"
    `)
  })

  it('should warn if there are duplicate entries in keyed functions', () => {
    vi.stubGlobal('__TEST_DEV__', true)

    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})

    KeyedFunctionsPlugin({ sourcemap: false, keyedFunctions, alias: {}, getAutoImports: () => Promise.resolve(autoImports) }).raw({}, {} as any)

    expect(warn).toHaveBeenCalledWith(expect.stringMatching(
      /\[nuxt:compiler\] \[keyed-functions\] Duplicate function name `useKeyTwo` with the same source `#app` found. Overwriting the existing entry./,
    ))
    warn.mockRestore()
    vi.unstubAllGlobals()
  })

  it('should handle multi-line parameters', async () => {
    const code = `
import { useKey, useKeyTwo } from '#app'
useKey(
)
useKeyTwo(
  () => {}
)

useKeyTwo(


  () => {}
)

useKeyTwo(
  () => {
  })
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useKey, useKeyTwo } from '#app'
      useKey(
      '$HJiaryoL2y' /* nuxt-injected */)
      useKeyTwo(
        () => {}
      , '$yysMIARJHe' /* nuxt-injected */)

      useKeyTwo(


        () => {}
      , '$Cy7hQH5X5O' /* nuxt-injected */)

      useKeyTwo(
        () => {
        }, '$Fl_F5LB-IM' /* nuxt-injected */)"
    `)
  })

  it('should handle trailing commas in parameters', async () => {
    const code = `
import { useKeyTwo } from '#app'
useKeyTwo(
  () => {},
)

useKeyTwo(
  () => {}
  ,)

useKeyTwo(

  () => {}

  ,
  )
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useKeyTwo } from '#app'
      useKeyTwo(
        () => {},
      '$HJiaryoL2y' /* nuxt-injected */)

      useKeyTwo(
        () => {}
        ,'$yysMIARJHe' /* nuxt-injected */)

      useKeyTwo(

        () => {}

        ,
        '$Cy7hQH5X5O' /* nuxt-injected */)"
    `)
  })

  it('should not add hash for non-matching function names', async () => {
    const code = `
import { useKeyThree } from '#app'
useKeyThree()
`
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should add hash in child scopes', async () => {
    const code = `
import { useKey } from '#app'
function foo() {
  useKey()

  if (true) {
    useKey()
  }
}
`
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useKey } from '#app'
      function foo() {
        useKey('$HJiaryoL2y' /* nuxt-injected */)

        if (true) {
          useKey('$yysMIARJHe' /* nuxt-injected */)
        }
      }"
    `)
  })

  it('should handle function shadowing', async () => {
    const code = `
import { useKey } from '#app'

function foo() {
  useKey()
  function useKey() { return 'local' }
}

useKey()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useKey } from '#app'

      function foo() {
        useKey()
        function useKey() { return 'local' }
      }

      useKey('$HJiaryoL2y' /* nuxt-injected */)"
    `)
  })

  it('should handle variable shadowing', async () => {
    const code = `
import { useKey } from '#app'

function foo() {
  const useKey = () => 'local'
  useKey()
}

useKey()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useKey } from '#app'

      function foo() {
        const useKey = () => 'local'
        useKey()
      }

      useKey('$HJiaryoL2y' /* nuxt-injected */)"
    `)
  })

  it('should handle function parameters shadowing', async () => {
    const code = `
import { useKey } from '#app'

function foo(useKey) {
  useKey()
}

const bar = useKey => useKey()

useKey()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useKey } from '#app'

      function foo(useKey) {
        useKey()
      }

      const bar = useKey => useKey()

      useKey('$HJiaryoL2y' /* nuxt-injected */)"
    `)
  })

  it('should add hash when processing file in `source` for exported functions', async () => {
    const code = `
useKeyTwo()
export const useKey = (arg1) => {}
useKey()
export function useKeyTwo(arg1, arg2) {}
    `
    expect((await transformPlugin.transform.handler(code, '#app'))?.code.trim()).toMatchInlineSnapshot(`
      "useKeyTwo('$QQV3F06xQZ' /* nuxt-injected */)
      export const useKey = (arg1) => {}
      useKey('$Bil3ev-zNC' /* nuxt-injected */)
      export function useKeyTwo(arg1, arg2) {}"
    `)
  })

  it('should not add hash to non-exported matching functions in `source`', async () => {
    const code = `
useKeyTwo()
const useKey = (arg1) => {}
useKey()
function useKeyTwo(arg1, arg2) {}
    `
    expect((await transformPlugin.transform.handler(code, '#app'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should handle standalone export declaration in `source`', async () => {
    const code = `
useKey()
function useKey(arg) {}
export { useKey }
`
    expect((await transformPlugin.transform.handler(code, '#app'))?.code.trim()).toMatchInlineSnapshot(`
      "useKey('$QQV3F06xQZ' /* nuxt-injected */)
      function useKey(arg) {}
      export { useKey }"
    `)
  })

  it('should not add hash to matching function names in `source` when renamed in export', async () => {
    const code = `
function useRenamedKey(arg) {}
useKey()
useRenamedKey()
function useKey(arg) {}
export { useKey as useRenamedKey }
`
    // we renamed the export, so the defined `useKey` is not exported and therefore should not get a hash
    // `useRenamedKey`, on the other hand, is not defined in keyed functions, so it should not get a hash either
    expect((await transformPlugin.transform.handler(code, '#app'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should add hash to original function in `source` with when renamed in export', async () => {
    const code = `
    foo()
    function foo(arg) {}
    function bar() {
      const foo = () => 'local'
      // still respects shadowing
      foo()
    }
    foo()
    export { foo as useKey }
    `

    expect((await transformPlugin.transform.handler(code, '#app'))?.code.trim()).toMatchInlineSnapshot(`
      "foo('$QQV3F06xQZ' /* nuxt-injected */)
          function foo(arg) {}
          function bar() {
            const foo = () => 'local'
            // still respects shadowing
            foo()
          }
          foo('$Bil3ev-zNC' /* nuxt-injected */)
          export { foo as useKey }"
    `)
  })

  it('should add hash to imported keyed function in `source` when renamed in export', async () => {
    const code = `
import { useKey } from '#app'
useKey('add-key-after')
export { useKey as useKeyTwoRenamed }
    `
    expect((await transformPlugin.transform.handler(code, 'renamed.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useKey } from '#app'
      useKey('add-key-after', '$Ja9NP0cDY0' /* nuxt-injected */)
      export { useKey as useKeyTwoRenamed }"
    `)
  })

  it('should handle shadowing in `source`', async () => {
    const code = `
useKey()
function useKey(arg) {}
function foo() {
  useKey()
  function useKey() { return 'local' }
  useKey()
}
function bar() {
  const useKey = () => 'local'
  useKey()
}
useKey()
export { useKey }
    `
    expect((await transformPlugin.transform.handler(code, '#app'))?.code.trim()).toMatchInlineSnapshot(`
      "useKey('$QQV3F06xQZ' /* nuxt-injected */)
      function useKey(arg) {}
      function foo() {
        useKey()
        function useKey() { return 'local' }
        useKey()
      }
      function bar() {
        const useKey = () => 'local'
        useKey()
      }
      useKey('$Bil3ev-zNC' /* nuxt-injected */)
      export { useKey }"
    `)
  })

  it('should not add key to default export if no default was specified for `source`', async () => {
    const code = `
useKey()
function useKey(arg) {}
export default useKey
    `
    expect((await transformPlugin.transform.handler(code, '#app'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should not add key to anonymous default export if no default was specified for `source`', async () => {
    const code = `
useKey()
export default function useKey(arg) {}
    `
    expect((await transformPlugin.transform.handler(code, '#app'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should handle default export in `source`', async () => {
    const code = `
useFoo()
function useFoo(arg) {}
export default useFoo
    `
    expect((await transformPlugin.transform.handler(code, '#app/defaultExport'))?.code.trim()).toMatchInlineSnapshot(`
      "useFoo('$gvnasIOzix' /* nuxt-injected */)
      function useFoo(arg) {}
      export default useFoo"
    `)
  })

  it('should handle arrow function default export in `source`', async () => {
    const code = `
const useFoo = (arg) => {}
useFoo()
export default useFoo
    `
    expect((await transformPlugin.transform.handler(code, '#app/defaultExport'))?.code.trim()).toMatchInlineSnapshot(`
      "const useFoo = (arg) => {}
      useFoo('$gvnasIOzix' /* nuxt-injected */)
      export default useFoo"
    `)
  })

  it('should handle anonymous default export in `source`', async () => {
    const code = `
useFoo()
export default function useFoo(arg) {}
    `
    expect((await transformPlugin.transform.handler(code, '#app/defaultExport'))?.code.trim()).toMatchInlineSnapshot(`
      "useFoo('$gvnasIOzix' /* nuxt-injected */)
      export default function useFoo(arg) {}"
    `)
  })

  it('should not add hash for imports from other sources', async () => {
    const code = `
import { useKey } from 'some-other-source'
import { useKeyTwo } from '#application' // deliberately using an alias starting with #app
useKey()
useKeyTwo()
`
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useKey } from 'some-other-source'
      import { useKeyTwo } from '#application' // deliberately using an alias starting with #app
      useKey()
      useKeyTwo('$HJiaryoL2y' /* nuxt-injected */)"
    `)
  })

  it('should add hash when renamed in import', async () => {
    const code = `
    import { useKey as useRenamedKey } from '#app'
    import { useKeyTwo as shouldNotAddHash } from './somewhere-else'

    useRenamedKey()
    shouldNotAddHash()
    `

    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useKey as useRenamedKey } from '#app'
          import { useKeyTwo as shouldNotAddHash } from './somewhere-else'

          useRenamedKey('$HJiaryoL2y' /* nuxt-injected */)
          shouldNotAddHash()"
    `)
  })

  it('should add hash for default import', async () => {
    const code = `
import useDefault from '#app/defaultExport'
useDefault()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import useDefault from '#app/defaultExport'
      useDefault('$HJiaryoL2y' /* nuxt-injected */)"
    `)
  })

  it('should add hash for renamed default import', async () => {
    const code = `
import { default as useRenamedDefault } from '#app/defaultExport'
useRenamedDefault()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { default as useRenamedDefault } from '#app/defaultExport'
      useRenamedDefault('$HJiaryoL2y' /* nuxt-injected */)"
    `)
  })

  it('should not add hash for non-matching default import', async () => {
    const code = `
import useDefault from '#app'
useDefault()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should add hash for namespace import', async () => {
    const code = `
import * as app from '#app'
app.useKey()
useKey()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import * as app from '#app'
      app.useKey('$HJiaryoL2y' /* nuxt-injected */)
      useKey()"
    `)
  })

  it('should handle namespace shadowing', async () => {
    const code = `
import * as app from '#app'
function foo() {
  const app = { useKey: () => 'local' }
  app.useKey()
}
app.useKey()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import * as app from '#app'
      function foo() {
        const app = { useKey: () => 'local' }
        app.useKey()
      }
      app.useKey('$HJiaryoL2y' /* nuxt-injected */)"
    `)
  })

  it('should not add hash for non-matching namespace import', async () => {
    const code = `
import * as other from 'some-other-source'
other.useKey()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should handle bracket access on namespace', async () => {
    const code = `
import * as app from '#app'
app['useKey']()
useKey()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import * as app from '#app'
      app['useKey']('$HJiaryoL2y' /* nuxt-injected */)
      useKey()"
    `)
  })

  it('should not add hash for dynamic bracket access on namespace', async () => {
    const code = `
import * as app from '#app'
app['useKey']() // has key
const keyName = 'useKey'
app[keyName]()
app['use' + 'Key']()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import * as app from '#app'
      app['useKey']('$HJiaryoL2y' /* nuxt-injected */) // has key
      const keyName = 'useKey'
      app[keyName]()
      app['use' + 'Key']()"
    `)
  })

  it('should not add hash for template literal access on a namespace', async () => {
    const code = `
import * as app from '#app'
app[\`useKey\`]()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should not add hash for dynamic import', async () => {
    const code = `
const mod = await import('#app')
mod.useKey()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should not add hash for destructured namespace', async () => {
    const code = `
import * as app from '#app'
const { useKey } = app
useKey()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should not add hash for type-only imports', async () => {
    const code = `
import type { useKey } from '#app'
useKey()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should handle mixed imports', async () => {
    const code = `
import useDefault, { useKey as useRenamedKey, useKeyTwo } from '#app'
import useDefaultKey from '#app/defaultExport'
useDefault()
useDefaultKey()
useRenamedKey()
useKeyTwo(() => {})
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import useDefault, { useKey as useRenamedKey, useKeyTwo } from '#app'
      import useDefaultKey from '#app/defaultExport'
      useDefault()
      useDefaultKey('$HJiaryoL2y' /* nuxt-injected */)
      useRenamedKey('$yysMIARJHe' /* nuxt-injected */)
      useKeyTwo(() => {}, '$Cy7hQH5X5O' /* nuxt-injected */)"
    `)
  })

  it('should handle renamed same-name function from different source', async () => {
    const code = `
import { useKey } from '#app'
import { useKey as useOtherKey } from 'some-other-source'
useKey()
useOtherKey()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useKey } from '#app'
      import { useKey as useOtherKey } from 'some-other-source'
      useKey('$HJiaryoL2y' /* nuxt-injected */)
      useOtherKey()"
    `)
  })

  it('should not add key to tagged templates', async () => {
    const code = `
import { useKeyTwo } from '#app'
useKeyTwo\`template string\`
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should not add key to a conditional callee', async () => {
    const code = `
import { useKey } from '#app'
(Math.random() > 0.5 ? useKey : () => {})()
Math.random() > 0.5 ? useKey() : null
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useKey } from '#app'
      (Math.random() > 0.5 ? useKey : () => {})()
      Math.random() > 0.5 ? useKey('$HJiaryoL2y' /* nuxt-injected */) : null"
    `)
  })

  it('should not add key to `call` or `apply`', async () => {
    const code = `
import { useKeyTwo } from '#app'
useKeyTwo.call(this)
useKeyTwo.apply(this, [])
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should always add key when there is a spread element in the arguments', async () => {
    const code = `
import { useKey, useKeyTwo } from '#app'
useKey(...args)
useKeyTwo(...args)
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useKey, useKeyTwo } from '#app'
      useKey(...args, '$HJiaryoL2y' /* nuxt-injected */)
      useKeyTwo(...args, '$yysMIARJHe' /* nuxt-injected */)"
    `)
  })

  it('should not add key when accessed as a deep property', async () => {
    const code = `
import * as app from '#app'
const pkg = { app }

pkg.app.useKey()
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should not add key when processing the same file multiple times (webpack problem)', async () => {
    const code = `
    import { useKeyTwo } from '#app'
    useKeyTwo('$HJiaryoL2y' /* nuxt-injected */)
    `

    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  // backwards compatibility
  it('should inject keys for auto-imported functions', async () => {
    const code = `
    import { useAutoImported } from '#app'
    useAutoImported()
    `

    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useAutoImported } from '#app'
          useAutoImported('$HJiaryoL2y' /* nuxt-injected */)"
    `)
  })

  it('should inject keys for regex-matched function sources', async () => {
    const code = `
    import { useRegexKey } from 'some-regex-matched-source'
    useRegexKey()
    `

    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useRegexKey } from 'some-regex-matched-source'
          useRegexKey('$HJiaryoL2y' /* nuxt-injected */)"
    `)
  })
})

describe('core keyed functions', () => {
  const keyedFunctions: KeyedFunction[] = [
    // these entries need to 100% match the ones defined in
    // packages/schema/src/config/build.ts
    // because some values are hard-coded in the plugin implementation
    { name: 'callOnce', argumentLength: 3, source: '#app/composables/once' },
    { name: 'defineNuxtComponent', argumentLength: 2, source: '#app/composables/component' },
    { name: 'useState', argumentLength: 2, source: '#app/composables/state' },
    { name: 'useFetch', argumentLength: 3, source: '#app/composables/fetch' },
    { name: 'useAsyncData', argumentLength: 3, source: '#app/composables/asyncData' },
    { name: 'useLazyAsyncData', argumentLength: 3, source: '#app/composables/asyncData' },
    { name: 'useLazyFetch', argumentLength: 3, source: '#app/composables/fetch' },
  ]
  const transformPlugin = KeyedFunctionsPlugin({ sourcemap: false, keyedFunctions, alias: {}, getAutoImports: () => Promise.resolve([]) }).raw({}, {} as any) as { transform: { handler: (code: string, id: string) => Promise<{ code: string } | null> } }

  it('should detect string type keys and not add a hash', async () => {
    const code = `
    import { useState } from '#app/composables/state'
    useState('stringKey')
    useState(\`templateStringKey\`)
    useState(\`template\${dynamic}StringKey\`)
    useState("doubleQuotedStringKey")
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should add a hash when key type cannot be determined statically', async () => {
    const code = `
    import { useState } from '#app/composables/state'
    useState('some' + 'key')
    useState(someVariable)
    useState(getKey())
    useState(obj.prop)
    useState(obj['prop'])
    useState(obj.met())
    `

    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useState } from '#app/composables/state'
          useState('some' + 'key', '$HJiaryoL2y' /* nuxt-injected */)
          useState(someVariable, '$yysMIARJHe' /* nuxt-injected */)
          useState(getKey(), '$Cy7hQH5X5O' /* nuxt-injected */)
          useState(obj.prop, '$Fl_F5LB-IM' /* nuxt-injected */)
          useState(obj['prop'], '$1GDT7saTf0' /* nuxt-injected */)
          useState(obj.met(), '$8YFL1gGJy8' /* nuxt-injected */)"
    `)
  })

  // --- useState ---
  describe('useState', () => {
    it('should add hash when none was provided', async () => {
      const code = `
import { useState } from '#app/composables/state'
useState(() => 1)
      `
      expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
        "import { useState } from '#app/composables/state'
        useState(() => 1, '$HJiaryoL2y' /* nuxt-injected */)"
      `)
    })

    it('should not add hash when one was provided as the first argument', async () => {
      const code = `
import { useState } from '#app/composables/state'
useState('key')
useState('$existingKey', () => 1)
      `

      expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
    })
  })

  // --- useFetch / useLazyFetch ---
  describe('useFetch', () => {
    it('should always add a hash', async () => {
      const code = `
import { useFetch, useLazyFetch } from '#app/composables/fetch'
useFetch('/api/data')
useFetch(() => '/api/data')
useFetch(url)
useFetch('/api/data', { method: 'POST' })
useFetch(() => '/api/data', { method: 'POST' })
useFetch(url, options)

useLazyFetch('/api/data')
useLazyFetch(() => '/api/data')
useLazyFetch(url)
useLazyFetch('/api/data', { method: 'POST' })
useLazyFetch(() => '/api/data', { method: 'POST' })
useLazyFetch(url, options)
      `

      expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
        "import { useFetch, useLazyFetch } from '#app/composables/fetch'
        useFetch('/api/data', '$HJiaryoL2y' /* nuxt-injected */)
        useFetch(() => '/api/data', '$yysMIARJHe' /* nuxt-injected */)
        useFetch(url, '$Cy7hQH5X5O' /* nuxt-injected */)
        useFetch('/api/data', { method: 'POST' }, '$Fl_F5LB-IM' /* nuxt-injected */)
        useFetch(() => '/api/data', { method: 'POST' }, '$1GDT7saTf0' /* nuxt-injected */)
        useFetch(url, options, '$8YFL1gGJy8' /* nuxt-injected */)

        useLazyFetch('/api/data', '$-6Jq0e1X0N' /* nuxt-injected */)
        useLazyFetch(() => '/api/data', '$PysQIWKhwV' /* nuxt-injected */)
        useLazyFetch(url, '$wjhr0zrAT4' /* nuxt-injected */)
        useLazyFetch('/api/data', { method: 'POST' }, '$H_jcqrI1sJ' /* nuxt-injected */)
        useLazyFetch(() => '/api/data', { method: 'POST' }, '$_jtliZGAeJ' /* nuxt-injected */)
        useLazyFetch(url, options, '$TtqJmekP-n' /* nuxt-injected */)"
      `)
    })
  })

  // --- useAsyncData / useLazyAsyncData ---
  describe('useAsyncData', () => {
    it('should add key when there was none provided', async () => {
      const code = `
import { useAsyncData, useLazyAsyncData } from '#app/composables/asyncData'
useAsyncData(() => $fetch('/api/data'))
useAsyncData(() => $fetch('/api/data'), { server: false })
      `

      expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
        "import { useAsyncData, useLazyAsyncData } from '#app/composables/asyncData'
        useAsyncData(() => $fetch('/api/data'), '$HJiaryoL2y' /* nuxt-injected */)
        useAsyncData(() => $fetch('/api/data'), { server: false }, '$yysMIARJHe' /* nuxt-injected */)"
      `)
    })

    it('should not add key when one was provided as the first or last argument', async () => {
      const code = `
import { useAsyncData, useLazyAsyncData } from '#app/composables/asyncData'
useAsyncData('key', () => $fetch('/api/data'))
useAsyncData('key', () => $fetch('/api/data'), { server: false })

useLazyAsyncData('key', () => $fetch('/api/data'))
useLazyAsyncData('key', () => $fetch('/api/data'), { server: false })
      `
      expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
    })
  })
})
