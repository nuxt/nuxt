import { beforeEach, describe, expect, it } from 'vitest'
import {
  KeyedFunctionFactoriesPlugin,
  KeyedFunctionFactoriesScanPlugin,
} from '../src/compiler/plugins/keyed-function-factories'
import type { KeyedFunctionFactory, Nuxt } from '@nuxt/schema'
import { createScanPluginContext } from '../src/compiler/utils'
import type { DeepPartial } from '#app/config.ts'

// -------- compiler scan plugin for scanning keyed function factories --------

function createMockNuxt (): Nuxt {
  return ({
    options: {
      alias: {
        '@': '/app',
        '#app': '/nuxt/app',
      },
      optimization: {
        keyedComposables: [],
      },
    },
  } satisfies DeepPartial<Nuxt>) as unknown as Nuxt
}

describe('keyed function factories scan plugin', () => {
  const factories: KeyedFunctionFactory[] = [
    {
      name: 'createUseFetch',
      source: '#app/composables/fetch',
      argumentLength: 3,
    },
    {
      name: 'createUseAsyncData',
      source: '#app/composables/async-data',
      argumentLength: 2,
    },
    {
      name: 'createUseKey',
      source: '~/composables/useKey.ts', // deliberately using an extension here
      argumentLength: 1,
    },
  ]

  const autoImportsToSources = new Map<string, string>([
    ['createUseFetch', '#app/composables/fetch'],
  ])

  async function callScanPlugin (id: string, code: string, nuxt: Nuxt, overrides?: {
    autoImportsToSources?: Map<string, string>
  }) {
    const plugin = KeyedFunctionFactoriesScanPlugin({ factories, alias: nuxt.options.alias })
    const context = createScanPluginContext(code, id)
    await plugin.scan.call(context, {
      id,
      code,
      nuxt,
      autoImportsToSources: overrides?.autoImportsToSources ?? autoImportsToSources,
    })
    plugin.afterScan?.(nuxt)
  }

  let mockNuxt: Nuxt
  beforeEach(() => {
    mockNuxt = createMockNuxt()
  })

  it('should collect keyed functions created by factories', async () => {
    const code = `
      import { createUseFetch } from '#app/composables/fetch'
      export const useFetch = createUseFetch({
        defaults: {
          baseURL: 'https://example.com',
        },
      })
      export const useAnotherFetch = createUseFetch()
    `

    await callScanPlugin('fetch.ts', code, mockNuxt)

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`
      [
        {
          "argumentLength": 3,
          "name": "useFetch",
          "source": "fetch.ts",
        },
        {
          "argumentLength": 3,
          "name": "useAnotherFetch",
          "source": "fetch.ts",
        },
      ]
    `)
  })

  it('should collect keyed function from default export', async () => {
    const code = `
        import { createUseFetch } from '#app/composables/fetch'
        export default createUseFetch()
      `

    // check that it converts to camel case from kebab case file name
    await callScanPlugin('@/composables/use-my-api.ts', code, mockNuxt)

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`
      [
        {
          "argumentLength": 3,
          "name": "default",
          "source": "@/composables/use-my-api.ts",
        },
      ]
    `)
  })

  it('should keep casing in named exports', async () => {
    const code = `
        import { createUseFetch } from '#app/composables/fetch'
        export const use_my_api = createUseFetch()
    `

    await callScanPlugin('@/composables/use-my-api.ts', code, mockNuxt)

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`
      [
        {
          "argumentLength": 3,
          "name": "use_my_api",
          "source": "@/composables/use-my-api.ts",
        },
      ]
    `)
  })

  it('should not collect functions that are not exported', async () => {
    const code = `
      import { createUseFetch } from '#app/composables/fetch'
      const useFetch = createUseFetch()

      export const useExportedFetch = createUseFetch()

      function foo() {
        const useAnotherFetch = createUseFetch()
      }

      try {
        const useTryFetch = createUseFetch()
      } catch (e) {
      }
    `

    await callScanPlugin('fetch.ts', code, mockNuxt)

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`
      [
        {
          "argumentLength": 3,
          "name": "useExportedFetch",
          "source": "fetch.ts",
        },
      ]
    `)
  })

  it('should collect same-name functions from different modules', async () => {
    const code = `
      import { createUseFetch } from '#app/composables/fetch'
      export const useFetch = createUseFetch()
    `

    await callScanPlugin('file1.ts', code, mockNuxt)
    await callScanPlugin('file2.ts', code, mockNuxt)

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`
      [
        {
          "argumentLength": 3,
          "name": "useFetch",
          "source": "file1.ts",
        },
        {
          "argumentLength": 3,
          "name": "useFetch",
          "source": "file2.ts",
        },
      ]
    `)
  })

  it('should not collect functions created by factories from non-matching sources', async () => {
    const code = `
        import { createUseFetch } from '#app/some-other-place'
        export const useFetch = createUseFetch()
      `

    await callScanPlugin('fetch.ts', code, mockNuxt)

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot('[]')
  })

  it('should collect functions created by renamed factories ', async () => {
    const code = `
        import { createUseFetch as renamedCreateUseFetch } from '#app/composables/fetch'
        export const useFetch = renamedCreateUseFetch()
      `

    await callScanPlugin('fetch.ts', code, mockNuxt)

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`
      [
        {
          "argumentLength": 3,
          "name": "useFetch",
          "source": "fetch.ts",
        },
      ]
    `)
  })

  it('should collect functions created by auto-imported factories with matching source', async () => {
    const code = `
      export const useFetch = createUseFetch()
    `

    await callScanPlugin('fetch.ts', code, mockNuxt)

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`
      [
        {
          "argumentLength": 3,
          "name": "useFetch",
          "source": "fetch.ts",
        },
      ]
    `)
  })

  it('should not collect functions created by auto-imported factories with non-matching source', async () => {
    const code = `
      export const useFetch = createUseFetch()
    `

    const autoImportsToSources = new Map<string, string>([
      // different `createUseFetch` function, not the real factory defined in `factories: KeyedFunctionFactory[]`
      ['createUseFetch', '#app/some-other-place'],
    ])

    await callScanPlugin('fetch.ts', code, mockNuxt, { autoImportsToSources })

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot('[]')
  })

  it('should not collect functions created by auto-imported factories when there are no auto-imports', async () => {
    const code = `
      export const useFetch = createUseFetch()
    `

    await callScanPlugin('fetch.ts', code, mockNuxt, { autoImportsToSources: new Map() })

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot('[]')
  })

  it('should collect functions when factory is imported with or without an extension', async () => {
    const code = `
    import { createUseFetch } from '#app/composables/fetch.ts'
    import { createUseKey } from '~/composables/useKey'
    export const useFetch = createUseFetch()
    export const useKey = createUseKey()
    `

    await callScanPlugin('file.ts', code, mockNuxt)
    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`
      [
        {
          "argumentLength": 3,
          "name": "useFetch",
          "source": "file.ts",
        },
        {
          "argumentLength": 1,
          "name": "useKey",
          "source": "file.ts",
        },
      ]
    `)
  })

  it('should collect functions from factories imported through a namespace', async () => {
    const code = `
      import * as factories from '#app/composables/fetch'
      export const useFetch = factories.createUseFetch()
    `

    await callScanPlugin('fetch.ts', code, mockNuxt)

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`
      [
        {
          "argumentLength": 3,
          "name": "useFetch",
          "source": "fetch.ts",
        },
      ]
    `)
  })

  it('should collect functions from factories accessed via bracket notation on a namespace', async () => {
    const code = `
    import * as factories from '#app/composables/fetch'
    export const useFetch = factories['createUseFetch']()
  `
    await callScanPlugin('fetch.ts', code, mockNuxt)
    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`
      [
        {
          "argumentLength": 3,
          "name": "useFetch",
          "source": "fetch.ts",
        },
      ]
    `)
  })

  it('should collect functions from factories when using a chain expression', async () => {
    const code = `
    import * as factories from '#app/composables/fetch'
    export const useFetch = factories?.createUseFetch?.()
    export const useSecondFetch = factories?.['createUseFetch']?.()
    export const useThirdFetch = factories?.['createUseFetch']()
    export const useFourthFetch = factories.createUseFetch?.()
    export const useFifthFetch = factories['createUseFetch']?.()
  `
    await callScanPlugin('fetch.ts', code, mockNuxt)
    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`
      [
        {
          "argumentLength": 3,
          "name": "useFetch",
          "source": "fetch.ts",
        },
        {
          "argumentLength": 3,
          "name": "useSecondFetch",
          "source": "fetch.ts",
        },
        {
          "argumentLength": 3,
          "name": "useThirdFetch",
          "source": "fetch.ts",
        },
        {
          "argumentLength": 3,
          "name": "useFourthFetch",
          "source": "fetch.ts",
        },
        {
          "argumentLength": 3,
          "name": "useFifthFetch",
          "source": "fetch.ts",
        },
      ]
    `)
  })

  it('should not collect function when accessed through a namespace of a different source', async () => {
    const code = `
      import * as namespace from '#app/composables/fetch'
      import * as wrongNamespace from '#app/somewhere-else'
      export const useFetch = wrongNamespace.createUseFetch()
    `

    await callScanPlugin('fetch.ts', code, mockNuxt)

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot('[]')
  })

  it('should collect function when accessed through one of multiple namespaces of the correct source', async () => {
    const code = `
      import * as namespace from '#app/composables/fetch'
      import * as anotherNamespace from '#app/composables/fetch'
      export const useFetch1 = namespace.createUseFetch()
      export const useFetch2 = anotherNamespace.createUseFetch()
    `

    await callScanPlugin('fetch.ts', code, mockNuxt)

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`
      [
        {
          "argumentLength": 3,
          "name": "useFetch1",
          "source": "fetch.ts",
        },
        {
          "argumentLength": 3,
          "name": "useFetch2",
          "source": "fetch.ts",
        },
      ]
    `)
  })

  it('should not collect functions from factories imported normally when accessed through the wrong namespace', async () => {
    const code = `
      import { createUseFetch } from '#app/composables/fetch'
      import * as somewhereElse from '#app/somewhere-else'
      export const useFetch = somewhereElse.createUseFetch()
    `

    await callScanPlugin('fetch.ts', code, mockNuxt)

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot('[]')
  })

  it('should collect functions when factory is imported both normally and via *', async () => {
    const code = `
      import { createUseFetch } from '#app/composables/fetch'
      import * as factories from '#app/composables/fetch'
      export const useFetch1 = createUseFetch()
      export const useFetch2 = factories.createUseFetch()
    `

    await callScanPlugin('fetch.ts', code, mockNuxt)

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`
      [
        {
          "argumentLength": 3,
          "name": "useFetch1",
          "source": "fetch.ts",
        },
        {
          "argumentLength": 3,
          "name": "useFetch2",
          "source": "fetch.ts",
        },
      ]
    `)
  })

  it('should not collect functions from factories imported via renamed * when not accessed through the namespace', async () => {
    const code = `
      import * as factories from '#app/composables/fetch'
      export const useFetch = createUseFetch()
    `

    await callScanPlugin('fetch.ts', code, mockNuxt, {
      // no auto-imports to prevent `createUseFetch()` from being recognized
      autoImportsToSources: new Map(),
    })

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot('[]')
  })

  it('should collect functions from default export of factories accessed via a namespace', async () => {
    const code = `
      import * as everything from '#app/composables/fetch'
      export default everything.createUseFetch()
    `

    await callScanPlugin('useFetch.ts', code, mockNuxt)

    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`
      [
        {
          "argumentLength": 3,
          "name": "default",
          "source": "useFetch.ts",
        },
      ]
    `)
  })

  it('ignores locally shadowed factory names', async () => {
    const code = `
    import { createUseFetch } from '#app/composables/fetch'
    export const useFetch1 = createUseFetch()
    function createUseFetch() { return () => {} }
    export const useFetch2 = createUseFetch()
  `
    await callScanPlugin('fetch.ts', code, mockNuxt)
    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`[]`)
  })

  it('does not collect when factory is pulled out of a namespace via destructuring', async () => {
    const code = `
    import * as factories from '#app/composables/fetch'
    const { createUseFetch } = factories
    export const useFetch = createUseFetch()
  `
    await callScanPlugin('fetch.ts', code, mockNuxt)
    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot('[]')
  })

  it('does not collect when factory is assigned to an alias variable before calling', async () => {
    const code = `
    import { createUseFetch } from '#app/composables/fetch'
    const mk = createUseFetch
    export const useFetch = mk()
  `
    await callScanPlugin('fetch.ts', code, mockNuxt)
    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot('[]')
  })

  it('should ignore type-only named import', async () => {
    const code = `
    import type { createUseFetch } from '#app/composables/fetch'
    // @ts-expect-error: createUseFetch is a type-only import, cannot be called
    export const useFetch = createUseFetch()
  `
    await callScanPlugin('fetch.ts', code, mockNuxt)
    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`[]`)
  })

  it('should ignore type-modified specifier', async () => {
    const code = `
    import { type createUseFetch } from '#app/composables/fetch'
    // @ts-expect-error: type-only import
    export const useFetch = createUseFetch()
  `
    await callScanPlugin('fetch.ts', code, mockNuxt)
    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`[]`)
  })

  it('should ignore type-only namespace import', async () => {
    const code = `
    import type * as factories from '#app/composables/fetch'
    // @ts-expect-error: factories is type-only
    export const useFetch = factories.createUseFetch()
  `
    await callScanPlugin('fetch.ts', code, mockNuxt)
    expect(mockNuxt.options.optimization.keyedComposables).toMatchInlineSnapshot(`[]`)
  })
})

// -------- unplugin for replacing keyed factory macros --------

describe('keyed function factories plugin', () => {
  const factories: KeyedFunctionFactory[] = [
    {
      name: 'createUseFetch',
      source: '#app/composables/fetch',
      argumentLength: 3,
    },
    {
      name: 'createUseKey',
      source: '~/composables/useKey.ts', // deliberately using an extension here
      argumentLength: 1,
    },
  ]

  const transformPlugin = KeyedFunctionFactoriesPlugin({ sourcemap: false, factories, alias: {} }).raw({}, {} as any) as {
    transform: { handler: (code: string, id: string) => Promise<{ code: string } | null> }
  }

  it('should replace placeholder macro with actual factory', async () => {
    const code = `
     import { createUseFetch } from '#app/composables/fetch'
     export const useFetch = createUseFetch()
    `

    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { createUseFetch } from '#app/composables/fetch'
           export const useFetch = createUseFetch.__nuxt_factory()"
    `)
  })

  it('should handle multiple declarations on a single line', async () => {
    const code = `
     import { createUseFetch } from '#app/composables/fetch'
     export const useFetch = createUseFetch(), another = createUseFetch()
    `

    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { createUseFetch } from '#app/composables/fetch'
           export const useFetch = createUseFetch.__nuxt_factory(), another = createUseFetch.__nuxt_factory()"
    `)
  })

  it('should not transform different functions with the same name', async () => {
    const code = `
     import { createUseFetch } from '#app/some-other-place'
     export const useFetch = createUseFetch()
    `

    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toBeUndefined()
  })

  it('should transform factories when imported with or without an extension', async () => {
    const code = `
    import { createUseFetch } from '#app/composables/fetch.ts'
    import { createUseKey } from '~/composables/useKey'
    export const useFetch = createUseFetch()
    export const useKey = createUseKey()
    `

    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { createUseFetch } from '#app/composables/fetch.ts'
          import { createUseKey } from '~/composables/useKey'
          export const useFetch = createUseFetch.__nuxt_factory()
          export const useKey = createUseKey.__nuxt_factory()"
    `)
  })

  it('should transform factories renamed in import', async () => {
    const code = `
     import { createUseFetch as renamedCreateUseFetch } from '#app/composables/fetch'
     export const useFetch = renamedCreateUseFetch()
    `

    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { createUseFetch as renamedCreateUseFetch } from '#app/composables/fetch'
           export const useFetch = renamedCreateUseFetch.__nuxt_factory()"
    `)
  })

  it('should not transform factories without specific import source', async () => {
    // in this case, we don't need to test for auto-imports, since the transform plugin will
    // run only after the imports have been injected
    const code = `
     export const useFetch = createUseFetch()
    `

    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toBeUndefined()
  })

  it('should transform factory accessed through namespaced import', async () => {
    const code = `
    import * as factories from '#app/composables/fetch'
    export const useFetch = factories.createUseFetch()
    `

    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import * as factories from '#app/composables/fetch'
          export const useFetch = factories.createUseFetch.__nuxt_factory()"
    `)
  })

  it('should transform factory accessed through bracket notation on a namespace', async () => {
    const code = `
    import * as factories from '#app/composables/fetch'
    export const useFetch = factories['createUseFetch']()
    `

    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import * as factories from '#app/composables/fetch'
          export const useFetch = factories['createUseFetch'].__nuxt_factory()"
    `)
  })

  it('should only transform factories from the allowed source when same name exists from elsewhere', async () => {
    const code = `
      import { createUseFetch as a } from '#app/composables/fetch'
      import { createUseFetch as b } from '#app/other'
      export const x = a()
      export const y = b()
    `
    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { createUseFetch as a } from '#app/composables/fetch'
            import { createUseFetch as b } from '#app/other'
            export const x = a.__nuxt_factory()
            export const y = b()"
    `)
  })

  it('should transform factory when using optional chaining', async () => {
    const code = `
    import * as factories from '#app/composables/fetch'
    export const a = factories.createUseFetch?.()
    export const b = factories?.createUseFetch()
    export const c = factories?.createUseFetch?.()
    export const d = (factories.createUseFetch)?.()
    export const e = factories['createUseFetch']?.()
    export const f = factories?.['createUseFetch']()
    export const g = factories?.['createUseFetch']?.()
    export const h = (factories['createUseFetch'])?.()
    `

    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import * as factories from '#app/composables/fetch'
          export const a = factories.createUseFetch?.__nuxt_factory()
          export const b = factories?.createUseFetch.__nuxt_factory()
          export const c = factories?.createUseFetch?.__nuxt_factory()
          export const d = (factories.createUseFetch)?.__nuxt_factory()
          export const e = factories['createUseFetch']?.__nuxt_factory()
          export const f = factories?.['createUseFetch'].__nuxt_factory()
          export const g = factories?.['createUseFetch']?.__nuxt_factory()
          export const h = (factories['createUseFetch'])?.__nuxt_factory()"
    `)
  })

  it('should not transform factory when not accessed through namespace', async () => {
    const code = `
    import * as factories from '#app/composables/fetch'
    export const useFetch = createUseFetch()
    export const useOptionalFetch = factories?.someOtherFunction?.()
    `

    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toBeUndefined()
  })

  it('should transform local factories with separate declaration and export', async () => {
    const code = `
     import { createUseFetch } from '#app/composables/fetch'
     const useFetch = createUseFetch()
     const useAnother = createUseFetch()
     const useNotTransformed = createUseFetch()

     export { useFetch, useAnother }
    `

    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { createUseFetch } from '#app/composables/fetch'
           const useFetch = createUseFetch.__nuxt_factory()
           const useAnother = createUseFetch.__nuxt_factory()
           const useNotTransformed = createUseFetch()

           export { useFetch, useAnother }"
    `)
  })

  it('should transform local factories when result is renamed in export', async () => {
    const code = `
     import { createUseFetch } from '#app/composables/fetch'
     const useFetch = createUseFetch()

     export { useFetch as renamedUseFetch }
    `

    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { createUseFetch } from '#app/composables/fetch'
           const useFetch = createUseFetch.__nuxt_factory()

           export { useFetch as renamedUseFetch }"
    `)
  })

  it('should not transform local factories when result is not exported', async () => {
    const code = `
     import { createUseFetch } from '#app/composables/fetch'
     const useFetch = createUseFetch()
    `

    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toBeUndefined()
  })

  it('should not transform factories in non-top level', async () => {
    const code = `
     import { createUseFetch } from '#app/composables/fetch'
     {
        const useFetch = createUseFetch()
     }

     function factory() {
        const useFetch = createUseFetch()
        return useFetch
      }
      `

    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should not transform when local variable shadows the factory', async () => {
    const code = `
    import { createUseFetch as importedCreateUseFetch } from '#app/composables/fetch'
    const createUseFetch = () => () => {}
    export const useFetch = createUseFetch()
  `
    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code).toBeUndefined()
  })

  it('should transform when only an inner-scope binding shadows the name', async () => {
    const code = `
      import { createUseFetch } from '#app/composables/fetch'
      { const createUseFetch = () => () => {} }
      export const useFetch = createUseFetch()
    `
    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { createUseFetch } from '#app/composables/fetch'
            { const createUseFetch = () => () => {} }
            export const useFetch = createUseFetch.__nuxt_factory()"
    `)
  })

  it('should not transform when property is computed dynamically', async () => {
    const code = `
    import * as factories from '#app/composables/fetch'
    const key = 'createUseFetch'
    export const useFetch = factories[key]()
  `
    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toBeUndefined()
  })

  it('should not transform when property is computed via template literal', async () => {
    const code = `
    import * as factories from '#app/composables/fetch'
    export const useFetch = factories[\`createUseFetch\`]()
  `
    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toBeUndefined()
  })

  it('should transform default export', async () => {
    const code = `
    import { createUseFetch } from '#app/composables/fetch'
    export default createUseFetch()
  `
    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { createUseFetch } from '#app/composables/fetch'
          export default createUseFetch.__nuxt_factory()"
    `)
  })

  it('should ignore re-exports of the factory', async () => {
    const code = `
    export { createUseFetch } from '#app/composables/fetch'
    `
    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toBeUndefined()
  })

  it('should not transform dynamic import', async () => {
    const code = `
    export const make = async () => {
      const m = await import('#app/composables/fetch')
      return m.createUseFetch()
    }
    `
    expect((await transformPlugin.transform.handler(code, 'fetch.ts'))?.code.trim()).toBeUndefined()
  })
})
