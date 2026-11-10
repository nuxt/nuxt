import { describe, expect, it } from 'vitest'
import {
  KeyedFunctionFactoriesPlugin,
  KeyedFunctionFactoriesScanPlugin,
  scanFileForFactories,
} from '../src/compiler/plugins/keyed-function-factories'
import type { KeyedFunctionFactory, Nuxt } from '@nuxt/schema'
import { createScanPluginContext } from '../src/compiler/utils'
import type { DeepPartial } from '#app/config.ts'
import type { Import } from 'unimport'

const fetchFactory: KeyedFunctionFactory = { name: 'createUseFetch', source: '#app/composables/fetch', argumentLength: 3 }
// deliberately registered with an extension
const keyFactory: KeyedFunctionFactory = { name: 'createUseKey', source: '~/composables/useKey.ts', argumentLength: 1 }

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
  const factories = [fetchFactory, { name: 'createUseAsyncData', source: '#app/composables/async-data', argumentLength: 2 }, keyFactory]
  const defaultAutoImports = new Map([['createUseFetch', '#app/composables/fetch']])

  async function scan (code: string, options: { id?: string, nuxt?: Nuxt, autoImportsToSources?: Map<string, string> } = {}) {
    const { id = 'fetch.ts', nuxt = createMockNuxt(), autoImportsToSources = defaultAutoImports } = options
    const plugin = KeyedFunctionFactoriesScanPlugin({ factories, alias: nuxt.options.alias })
    await plugin.scan.call(createScanPluginContext(code, id), { id, code, nuxt, autoImportsToSources })
    plugin.afterScan?.(nuxt)
    return nuxt.options.optimization.keyedComposables
  }

  const scanNames = async (...args: Parameters<typeof scan>) => (await scan(...args)).map(k => k.name)

  it('should collect keyed functions created by factories', async () => {
    expect(await scan(`
import { createUseFetch } from '#app/composables/fetch'
export const useFetch = createUseFetch({ defaults: { baseURL: 'https://example.com' } })
export const useAnotherFetch = createUseFetch()
    `)).toEqual([
      { argumentLength: 3, name: 'useFetch', source: 'fetch.ts' },
      { argumentLength: 3, name: 'useAnotherFetch', source: 'fetch.ts' },
    ])
  })

  it('should collect keyed function from default export', async () => {
    expect(await scan(`
import { createUseFetch } from '#app/composables/fetch'
export default createUseFetch()
    `, { id: '@/composables/use-my-api.ts' })).toEqual([{ argumentLength: 3, name: 'default', source: '@/composables/use-my-api.ts' }])
  })

  it('should collect same-name functions from different modules', async () => {
    const nuxt = createMockNuxt()
    const code = `import { createUseFetch } from '#app/composables/fetch'\nexport const useFetch = createUseFetch()`
    await scan(code, { id: 'file1.ts', nuxt })
    expect((await scan(code, { id: 'file2.ts', nuxt })).map(k => k.source)).toEqual(['file1.ts', 'file2.ts'])
  })

  it('should collect functions when factory is imported with or without an extension', async () => {
    expect(await scan(`
import { createUseFetch } from '#app/composables/fetch.ts'
import { createUseKey } from '~/composables/useKey'
export const useFetch = createUseFetch()
export const useKey = createUseKey()
    `, { id: 'file.ts' })).toEqual([
      { argumentLength: 3, name: 'useFetch', source: 'file.ts' },
      { argumentLength: 1, name: 'useKey', source: 'file.ts' },
    ])
  })

  it.each([
    ['named exports, keeping their casing', `
import { createUseFetch } from '#app/composables/fetch'
export const use_my_api = createUseFetch()`, ['use_my_api']],
    ['only exported functions', `
import { createUseFetch } from '#app/composables/fetch'
const useFetch = createUseFetch()
export const useExportedFetch = createUseFetch()
function foo() {
  const useAnotherFetch = createUseFetch()
}
try {
  const useTryFetch = createUseFetch()
} catch (e) {}`, ['useExportedFetch']],
    ['renamed factories', `
import { createUseFetch as renamedCreateUseFetch } from '#app/composables/fetch'
export const useFetch = renamedCreateUseFetch()`, ['useFetch']],
    ['auto-imported factories with matching source', `
export const useFetch = createUseFetch()`, ['useFetch']],
    ['factories imported through a namespace', `
import * as factories from '#app/composables/fetch'
export const useFetch = factories.createUseFetch()
export const useBracketFetch = factories['createUseFetch']()`, ['useFetch', 'useBracketFetch']],
    ['factories called through a chain expression', `
import * as factories from '#app/composables/fetch'
export const useFetch = factories?.createUseFetch?.()
export const useSecondFetch = factories?.['createUseFetch']?.()
export const useThirdFetch = factories?.['createUseFetch']()
export const useFourthFetch = factories.createUseFetch?.()
export const useFifthFetch = factories['createUseFetch']?.()`, ['useFetch', 'useSecondFetch', 'useThirdFetch', 'useFourthFetch', 'useFifthFetch']],
    ['factories through any of multiple namespaces of the correct source', `
import * as namespace from '#app/composables/fetch'
import * as anotherNamespace from '#app/composables/fetch'
export const useFetch1 = namespace.createUseFetch()
export const useFetch2 = anotherNamespace.createUseFetch()`, ['useFetch1', 'useFetch2']],
    ['factories imported both normally and via *', `
import { createUseFetch } from '#app/composables/fetch'
import * as factories from '#app/composables/fetch'
export const useFetch1 = createUseFetch()
export const useFetch2 = factories.createUseFetch()`, ['useFetch1', 'useFetch2']],
    ['default exports of factories accessed via a namespace', `
import * as everything from '#app/composables/fetch'
export default everything.createUseFetch()`, ['default']],
    // a type-only import is not a binding, so the auto-import applies
    ['calls of type-only named imports through auto-imports', `
import type { createUseFetch } from '#app/composables/fetch'
export const useFetch = createUseFetch()`, ['useFetch']],
    ['calls of type-modified specifiers through auto-imports', `
import { type createUseFetch } from '#app/composables/fetch'
export const useFetch = createUseFetch()`, ['useFetch']],
  ])('should collect %s', async (_, code, expected) => {
    expect(await scanNames(code)).toEqual(expected)
  })

  it.each([
    ['factories from non-matching sources', `
import { createUseFetch } from '#app/some-other-place'
export const useFetch = createUseFetch()`],
    ['factories through a namespace of a different source', `
import * as namespace from '#app/composables/fetch'
import * as wrongNamespace from '#app/somewhere-else'
export const useFetch = wrongNamespace.createUseFetch()`],
    ['imported factories accessed through the wrong namespace', `
import { createUseFetch } from '#app/composables/fetch'
import * as somewhereElse from '#app/somewhere-else'
export const useFetch = somewhereElse.createUseFetch()`],
    ['locally shadowed factory names', `
import { createUseFetch } from '#app/composables/fetch'
export const useFetch1 = createUseFetch()
function createUseFetch() { return () => {} }
export const useFetch2 = createUseFetch()`],
    ['factories destructured from a namespace', `
import * as factories from '#app/composables/fetch'
const { createUseFetch } = factories
export const useFetch = createUseFetch()`],
    ['factories assigned to another variable', `
import { createUseFetch } from '#app/composables/fetch'
const mk = createUseFetch
export const useFetch = mk()`],
    ['type-only namespace imports', `
import type * as factories from '#app/composables/fetch'
export const useFetch = factories.createUseFetch()`],
  ])('should not collect %s', async (_, code) => {
    expect(await scan(code)).toEqual([])
  })

  it.each([
    ['from a non-matching source', new Map([['createUseFetch', '#app/some-other-place']])],
    ['when there are no auto-imports', new Map()],
  ])('should not collect auto-imported factories %s', async (_, autoImportsToSources) => {
    expect(await scan(`export const useFetch = createUseFetch()`, { autoImportsToSources })).toEqual([])
    expect(await scan(`import * as factories from '#app/composables/fetch'\nexport const useFetch = createUseFetch()`, { autoImportsToSources })).toEqual([])
  })

  it('should track results per file, overwrite them when re-scanning and flatten them after scanning', async () => {
    const plugin = KeyedFunctionFactoriesScanPlugin({ factories: [fetchFactory], alias: { '#app': '/nuxt/app' } })
    const nuxt = createMockNuxt()
    const scanFile = (id: string, ...names: string[]) => {
      const code = `import { createUseFetch } from '#app/composables/fetch'\n${names.map(name => `export const ${name} = createUseFetch()`).join('\n')}`
      return plugin.scan.call(createScanPluginContext(code, id), { id, code, nuxt, autoImportsToSources: defaultAutoImports })
    }

    await scanFile('/app/composables/api.ts', 'useApiFetch')
    await scanFile('/app/composables/other.ts', 'useOtherFetch', 'useThirdFetch')
    expect(plugin.result.fileResults.get('/app/composables/api.ts')).toHaveLength(1)
    expect(plugin.result.fileResults.get('/app/composables/other.ts')).toHaveLength(2)

    await scanFile('/app/composables/api.ts', 'useApiFetch', 'useApiFetch2')
    expect(plugin.result.fileResults.get('/app/composables/api.ts')).toHaveLength(2)
    expect(plugin.result.fileResults.size).toBe(2)

    plugin.afterScan?.(nuxt)
    expect(nuxt.options.optimization.keyedComposables.map(k => k.name)).toEqual(['useApiFetch', 'useApiFetch2', 'useOtherFetch', 'useThirdFetch'])
  })
})

describe('scanFileForFactories', () => {
  const alias = { '#app': '/nuxt/app', '@': '/app' }
  const namesToFactoryMeta = new Map([[fetchFactory.name, { ...fetchFactory, source: '/nuxt/app/composables/fetch' }]])
  const autoImportsToSources = new Map([['createUseFetch', '#app/composables/fetch']])

  it.each([
    ['explicitly imported', `import { createUseFetch } from '#app/composables/fetch'\nexport const useApiFetch = createUseFetch({ baseURL: '/api' })`, ['useApiFetch']],
    ['auto-imported', `export const useApiFetch = createUseFetch({ baseURL: '/api' })`, ['useApiFetch']],
    ['no', `export const myHelper = () => 'hello'`, []],
  ])('should find %s factory calls in a file', (_, code, expected) => {
    expect(scanFileForFactories('/app/composables/api.ts', code, namesToFactoryMeta, autoImportsToSources, alias))
      .toEqual(expected.map(name => ({ argumentLength: 3, name, source: '/app/composables/api.ts' })))
  })
})

describe('keyed function factories plugin', () => {
  function createTransform (getAutoImports: () => Promise<Import[]> = () => Promise.resolve([]), alias: Record<string, string> = {}) {
    const plugin = KeyedFunctionFactoriesPlugin({ factories: [fetchFactory, keyFactory], alias, getAutoImports }).raw({}, {} as any) as {
      transform: { handler: (code: string, id: string) => Promise<{ code: string } | undefined> }
    }
    return async (code: string, id = 'fetch.ts') => (await plugin.transform.handler(code, id))?.code.trim()
  }

  const transform = createTransform()

  it.each([
    ['a placeholder macro', `
import { createUseFetch } from '#app/composables/fetch'
export const useFetch = createUseFetch()`, `
export const useFetch = createUseFetch.__nuxt_factory()`],
    ['multiple declarations on a single line', `
import { createUseFetch } from '#app/composables/fetch'
export const useFetch = createUseFetch(), another = createUseFetch()`, `
export const useFetch = createUseFetch.__nuxt_factory(), another = createUseFetch.__nuxt_factory()`],
    ['factories imported with or without an extension', `
import { createUseFetch } from '#app/composables/fetch.ts'
import { createUseKey } from '~/composables/useKey'
export const useFetch = createUseFetch()
export const useKey = createUseKey()`, `
export const useFetch = createUseFetch.__nuxt_factory()
export const useKey = createUseKey.__nuxt_factory()`],
    ['factories renamed in import', `
import { createUseFetch as renamedCreateUseFetch } from '#app/composables/fetch'
export const useFetch = renamedCreateUseFetch()`, `
export const useFetch = renamedCreateUseFetch.__nuxt_factory()`],
    ['factories accessed through a namespace', `
import * as factories from '#app/composables/fetch'
export const useFetch = factories.createUseFetch()
export const useBracketFetch = factories['createUseFetch']()`, `
export const useFetch = factories.createUseFetch.__nuxt_factory()
export const useBracketFetch = factories['createUseFetch'].__nuxt_factory()`],
    ['only factories from the allowed source', `
import { createUseFetch as a } from '#app/composables/fetch'
import { createUseFetch as b } from '#app/other'
export const x = a()
export const y = b()`, `
export const x = a.__nuxt_factory()
export const y = b()`],
    ['optional chains', `
import * as factories from '#app/composables/fetch'
export const a = factories.createUseFetch?.()
export const b = factories?.createUseFetch()
export const c = factories?.createUseFetch?.()
export const d = (factories.createUseFetch)?.()
export const e = factories['createUseFetch']?.()
export const f = factories?.['createUseFetch']()
export const g = factories?.['createUseFetch']?.()
export const h = (factories['createUseFetch'])?.()`, `
export const a = factories.createUseFetch?.__nuxt_factory()
export const b = factories?.createUseFetch.__nuxt_factory()
export const c = factories?.createUseFetch?.__nuxt_factory()
export const d = (factories.createUseFetch)?.__nuxt_factory()
export const e = factories['createUseFetch']?.__nuxt_factory()
export const f = factories?.['createUseFetch'].__nuxt_factory()
export const g = factories?.['createUseFetch']?.__nuxt_factory()
export const h = (factories['createUseFetch'])?.__nuxt_factory()`],
    ['local factories exported separately, renamed or not', `
import { createUseFetch } from '#app/composables/fetch'
const useFetch = createUseFetch()
const useAnother = createUseFetch()
const useNotTransformed = createUseFetch()
export { useFetch, useAnother as renamed }`, `
const useFetch = createUseFetch.__nuxt_factory()
const useAnother = createUseFetch.__nuxt_factory()
const useNotTransformed = createUseFetch()
export { useFetch, useAnother as renamed }`],
    ['factories only shadowed in an inner scope', `
import { createUseFetch } from '#app/composables/fetch'
{ const createUseFetch = () => () => {} }
export const useFetch = createUseFetch()`, `
{ const createUseFetch = () => () => {} }
export const useFetch = createUseFetch.__nuxt_factory()`],
    ['default exports', `
import { createUseFetch } from '#app/composables/fetch'
export default createUseFetch()`, `
export default createUseFetch.__nuxt_factory()`],
  ])('should transform %s', async (_, code, expected) => {
    const imports = code.trim().split('\n').filter(line => line.startsWith('import ')).join('\n')
    expect(await transform(code)).toBe(imports + expected)
  })

  it.each([
    ['functions with the same name from other sources', `
import { createUseFetch } from '#app/some-other-place'
export const useFetch = createUseFetch()`],
    // auto-imports are injected before this plugin runs
    ['factories without an import', `export const useFetch = createUseFetch()`],
    ['factories not accessed through the namespace', `
import * as factories from '#app/composables/fetch'
export const useFetch = createUseFetch()
export const useOptionalFetch = factories?.someOtherFunction?.()`],
    ['local factories that are not exported', `
import { createUseFetch } from '#app/composables/fetch'
const useFetch = createUseFetch()`],
    ['factories below the top level', `
import { createUseFetch } from '#app/composables/fetch'
{
  const useFetch = createUseFetch()
}
function factory() {
  const useFetch = createUseFetch()
  return useFetch
}`],
    ['factories shadowed by a local variable', `
import { createUseFetch as importedCreateUseFetch } from '#app/composables/fetch'
const createUseFetch = () => () => {}
export const useFetch = createUseFetch()`],
    ['dynamically computed properties', `
import * as factories from '#app/composables/fetch'
const key = 'createUseFetch'
export const useFetch = factories[key]()`],
    ['template literal properties', `
import * as factories from '#app/composables/fetch'
export const useFetch = factories[\`createUseFetch\`]()`],
    ['re-exports of the factory', `export { createUseFetch } from '#app/composables/fetch'`],
    ['dynamic imports', `
export const make = async () => {
  const m = await import('#app/composables/fetch')
  return m.createUseFetch()
}`],
  ])('should not transform %s', async (_, code) => {
    expect(await transform(code)).toBeUndefined()
  })

  describe('auto-imports', () => {
    const alias = { '#app': '/nuxt/app' }
    const autoImport = (from: string): Import[] => [{ from, name: 'createUseFetch', as: 'createUseFetch' }]
    const id = '/app/composables/useApiFetch.ts'

    it('should transform auto-imported factories, preferring explicit imports', async () => {
      const transform = createTransform(() => Promise.resolve(autoImport('#app/composables/fetch')), alias)
      expect(await transform(`export const useApiFetch = createUseFetch({ baseURL: '/api' })`, id))
        .toBe(`export const useApiFetch = createUseFetch.__nuxt_factory({ baseURL: '/api' })`)
      expect(await transform(`import { createUseFetch } from '#app/other'\nexport const useApiFetch = createUseFetch({ baseURL: '/api' })`, id))
        .toBeUndefined()

      const conflictingTransform = createTransform(() => Promise.resolve(autoImport('#app/other')), alias)
      expect(await conflictingTransform(`import { createUseFetch } from '#app/composables/fetch'\nexport const useApiFetch = createUseFetch({ baseURL: '/api' })`, id))
        .toBe(`import { createUseFetch } from '#app/composables/fetch'\nexport const useApiFetch = createUseFetch.__nuxt_factory({ baseURL: '/api' })`)
    })

    it('should not transform auto-imported factory from wrong source', async () => {
      const transform = createTransform(() => Promise.resolve(autoImport('#app/some-other-place')), alias)
      expect(await transform(`export const useApiFetch = createUseFetch({ baseURL: '/api' })`, id)).toBeUndefined()
    })
  })
})
