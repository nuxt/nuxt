import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineKeyedFunctionFactory } from '../src/compiler'
import {
  type ExportMetadata,
  type FunctionCallMetadata,
  parseStaticExportIdentifiers,
  parseStaticFunctionCall,
} from '../src/core/utils/parse-utils.ts'
import { createScanPluginContext } from '../src/compiler/utils.ts'
import { ScopeTracker, parseAndWalk } from 'oxc-walker'
import type { Node } from 'oxc-parser'

function transformFactory<T extends (...args: any[]) => any> (factory: T): T {
  return (factory as unknown as { __nuxt_factory: T }).__nuxt_factory
}

describe('defineKeyedFunctionFactory', () => {
  const fn = (a: string, b: number): string => {
    return `${a}-${b}-value`
  }

  it('should produce factory that throws an error in dev when not transformed', () => {
    // mock import.meta.dev to `true`
    vi.stubGlobal('__TEST_DEV__', true)

    const factory = defineKeyedFunctionFactory({
      name: 'createUseFetch',
      factory: fn,
    })

    expect(() => factory('a', 1)).toThrowErrorMatchingInlineSnapshot(`[Error: [nuxt:compiler] \`createUseFetch\` is a compiler macro that is only usable inside the directories scanned by the Nuxt compiler as an exported function and imported statically. Learn more: \`https://nuxt.com/docs/TODO\`]`)

    vi.unstubAllGlobals()
  })

  it('should produce factory that returns undefined in production when not transformed', () => {
    const factory = defineKeyedFunctionFactory({
      name: 'createUseFetch',
      factory: fn,
    })

    expect(factory('a', 1)).toBeUndefined()
  })

  it('should have a non-enumerable `__nuxt_factory` property', () => {
    const fn = (a: string): string => a

    const factory = defineKeyedFunctionFactory({
      name: 'testFactory',
      factory: fn,
    })

    const descriptor = Object.getOwnPropertyDescriptor(factory, '__nuxt_factory')

    // property descriptor checks
    expect(descriptor).toBeDefined()
    expect(descriptor?.enumerable).toBe(false)
    expect(descriptor?.get?.()).toBe(fn)

    // sanity check
    expect(Object.keys(factory)).not.toContain('__nuxt_factory')
  })

  it('should return the factory function when transformed', () => {
    const factory = defineKeyedFunctionFactory({
      name: 'createUseFetch',
      factory: fn,
    })

    const transformedFactory = transformFactory(factory)

    expect(transformedFactory).toBeDefined()
    expect(typeof transformedFactory).toBe('function')
    expect(transformedFactory.length).toBe(fn.length)
    expect(transformedFactory('a', 1)).toBe('a-1-value')
  })

  it('should not catch errors from the factory function', () => {
    const errorFn = () => {
      throw new Error('Factory error')
    }
    const factory = defineKeyedFunctionFactory({
      name: 'errorFactory',
      factory: errorFn,
    })

    const transformedFactory = transformFactory(factory)

    expect(() => transformedFactory()).toThrowError('Factory error')
  })
})

async function importModules () {
  const [{ createScanPluginContext }, walker] = await Promise.all([
    import('../src/compiler/utils'),
    import('oxc-walker'),
  ])
  return { createScanPluginContext, walker }
}

describe('createScanPluginContext', () => {
  const code = `
    const a: number = 1
  `

  describe('mocked `oxc-walker`', () => {
    beforeEach(() => {
      vi.resetModules()

      vi.doMock('oxc-walker', () => {
        return {
          parseAndWalk: vi.fn(),
          walk: vi.fn(),
        }
      })
    })

    it('should generate context', async () => {
      const { createScanPluginContext } = await importModules()
      const context = createScanPluginContext(code, 'file.ts')

      expect(context).toBeDefined()
      expect(context).toHaveProperty('walkParsed')
      expect(typeof context.walkParsed).toBe('function')
    })

    it('should call `parseAndWalk` on first `walkParsed` call', async () => {
      const { createScanPluginContext, walker } = await importModules()
      const { parseAndWalk } = walker as unknown as {
        parseAndWalk: ReturnType<typeof vi.fn>
      }

      const enterCallback = { enter: vi.fn() }
      const mockParseResult = { program: {} }

      parseAndWalk.mockReturnValue(mockParseResult)

      const context = createScanPluginContext(code, 'file.ts')
      const result = context.walkParsed(enterCallback)

      expect(parseAndWalk).toHaveBeenCalledWith(code, 'file.ts', enterCallback)
      expect(result).toBe(mockParseResult)

      parseAndWalk.mockClear()
    })

    it('should reuse parse result and call `walk` on subsequent `walkParsed` calls', async () => {
      const { createScanPluginContext, walker } = await importModules()
      const { parseAndWalk, walk } = walker as unknown as {
        parseAndWalk: ReturnType<typeof vi.fn>
        walk: ReturnType<typeof vi.fn>
      }

      const firstCallback = { enter: vi.fn() }
      const secondCallback = { enter: vi.fn() }
      const mockParseResult = { program: {} }

      parseAndWalk.mockReturnValue(mockParseResult)

      const context = createScanPluginContext(code, 'file.ts')
      context.walkParsed(firstCallback)

      parseAndWalk.mockClear()
      const result = context.walkParsed(secondCallback)

      expect(parseAndWalk).not.toHaveBeenCalled() // not called again - reused
      expect(walk).toHaveBeenCalledWith(mockParseResult.program, secondCallback)
      expect(result).toBe(mockParseResult)
    })
  })

  it('should parse and walk the AST and track variables', () => {
    const code = `const a: number = 1`
    const nodes: Node[] = []
    const context = createScanPluginContext(code, 'file.ts')

    const scopeTracker = new ScopeTracker()
    let foundDecl = false

    context.walkParsed({
      scopeTracker,
      enter (node) {
        nodes.push(node)
        if (node.type === 'Identifier' && node.name === 'a') {
          const decl = scopeTracker.getDeclaration(node.name)
          expect(decl?.type).toBe('Variable')
          foundDecl = true
        }
      },
    })

    // ensure scope tracking worked
    expect(foundDecl).toBe(true)

    // ensure we walked the AST
    expect(nodes.length).toBe(7)
    expect(nodes.some(n => n.type === 'Program')).toBe(true)
    expect(nodes.some(n => n.type === 'VariableDeclarator')).toBe(true)
    expect(nodes.some(n => n.type === 'Identifier' && n.name === 'a')).toBe(true)
  })
})

describe('parseFunctionCall', () => {
  function getFirstParsedFunctionCall (code: string, functions: RegExp): FunctionCallMetadata | null {
    let result: FunctionCallMetadata | null = null

    parseAndWalk(code, 'file.ts', {
      enter (node) {
        if (node.type !== 'CallExpression' && node.type !== 'ChainExpression') {
          return
        }
        const res = parseStaticFunctionCall(node, functions)
        if (res) {
          result = res
          this.skip()
        }
      },
    })

    return result
  }

  function expectFunctionCallMeta (meta: FunctionCallMetadata | null, expected: {
    name: string
    namespace?: string | null
  }) {
    expect(meta).not.toBeNull()
    expect(meta?.name).toBe(expected.name)
    expect(meta?.namespace || null).toBe(expected.namespace || null)
    if (meta?.node.type === 'Identifier' && !meta.namespace) {
      expect(meta.node.name).toBe(expected.name)
    } else if (meta?.node.type === 'MemberExpression') {
      if (meta.node.property.type === 'Identifier') {
        expect(meta.node.property.name).toBe(expected.name)
      } else if (meta.node.property.type === 'Literal') {
        expect(meta.node.property.value).toBe(expected.name)
      } else {
        assert.fail(`Unexpected node property type ${meta.node.property.type}`)
      }
    }
    expect(meta?.callExpression.type).toBe('CallExpression')
  }

  it('should parse simple function call', () => {
    const code = `const data = useFetch('key')`
    const result = getFirstParsedFunctionCall(code, /useFetch/)
    expectFunctionCallMeta(result, { name: 'useFetch' })

    const code2 = `const data = useFetch()`
    const result2 = getFirstParsedFunctionCall(code2, /useFetch/)
    expectFunctionCallMeta(result2, { name: 'useFetch' })
  })

  it('should parse member call', () => {
    const code = `const x = factories.createUseFetch()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch', namespace: 'factories' })
  })

  it('should parse bracket member call', () => {
    const code = `const x = factories['createUseFetch']()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch', namespace: 'factories' })
  })

  it('should parse optional-chained member call', () => {
    const code = `const x = factories?.createUseFetch?.()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch', namespace: 'factories' })
  })

  it('should parse optional-chained bracket call', () => {
    const code = `const x = factories?.['createUseFetch']?.()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch', namespace: 'factories' })

    const code2 = `const x = factories?.['createUseFetch']()`
    const result2 = getFirstParsedFunctionCall(code2, /createUseFetch/)
    expectFunctionCallMeta(result2, { name: 'createUseFetch', namespace: 'factories' })
  })

  it('should parse call with await', () => {
    const code = `async function f(){ return await createUseFetch() }`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch' })
  })

  it('should parse optional chain under await', () => {
    const code = `async function f(){ return await factories?.createUseFetch?.() }`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch', namespace: 'factories' })
  })

  it('should be robust to global regex (/g) by not relying on lastIndex', () => {
    const code = `createUseFetch(); createUseFetch();`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/g)
    expectFunctionCallMeta(result, { name: 'createUseFetch' })
  })

  it('should parse inside template expressions', () => {
    const code = 'const s = `${factories.createUseFetch()}`'
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch', namespace: 'factories' })
  })

  it('should parse chained call result usage', () => {
    const code = `const y = (factories.createUseFetch())('key')`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch', namespace: 'factories' })
  })

  it('should handle parenthesized callee', () => {
    const code = `(createUseFetch)()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    // callee is a ParenthesizedExpression, not Identifier
    expectFunctionCallMeta(result, { name: 'createUseFetch' })
  })

  it('should handle parenthesized optional call', () => {
    const code = `(createUseFetch)?.()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch' })

    const code2 = `const x = (factories.createUseFetch)?.()`
    const result2 = getFirstParsedFunctionCall(code2, /createUseFetch/)
    expectFunctionCallMeta(result2, { name: 'createUseFetch', namespace: 'factories' })
  })

  it('should handle a TS as-cast callee', () => {
    const code = `const x = (createUseFetch as any)()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch' })
  })

  it('should handle a TS as-cast in member expression object', () => {
    const code = `const x = (factories as any).createUseFetch()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch', namespace: 'factories' })
  })

  it('should handle a TS non-null assertion callee', () => {
    const code = `const x = (createUseFetch!)()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch' })
  })

  it('should handle a TS non-null assertion in member expression object', () => {
    const code = `const x = (factories!).createUseFetch()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch', namespace: 'factories' })
  })

  it('should handle a TS type-assertion in parenthesized expression callee', () => {
    const code = `const x = (<any>createUseFetch)()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch' })
  })

  it('should handle a TS type-assertion in member expression object', () => {
    const code = `const x = (<any>factories).createUseFetch()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch', namespace: 'factories' })
  })

  it('should ignore similar names that do not match the filter', () => {
    const code = `createUseFetchX(); factories.createUseFetchX(); factories['createUseFetchX']()`
    const result = getFirstParsedFunctionCall(code, /\bcreateUseFetch\b/)
    expect(result).toBeNull()
  })

  it('should work with anchors in filter', () => {
    const code = `factories.createUseFetch()`
    const result = getFirstParsedFunctionCall(code, /^createUseFetch$/)
    expectFunctionCallMeta(result, { name: 'createUseFetch', namespace: 'factories' })
  })

  it('should handle calling class static methods', () => {
    const code = `class C{ static createUseFetch(){} } C.createUseFetch()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch', namespace: 'C' })
  })

  // non-statically analyzable cases:

  it('should return null for member expression object that is a call', () => {
    const code = `const x = getFactory().createUseFetch()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expect(result).toBeNull()
  })

  it('should return null for multi-level member expression object', () => {
    const code = `const x = pkg.factories.createUseFetch()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expect(result).toBeNull()
  })

  it('should ignore non-matching calls', () => {
    const code = `fn(); other();`
    const result = getFirstParsedFunctionCall(code, /doesNotExist/)
    expect(result).toBeNull()
  })

  it('should return null for dynamic expression calls', () => {
    const code = `const x = (ok ? factories.createUseFetch : noop)()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expect(result).toBeNull()
  })

  it('should return null for sequence callee', () => {
    const code = `(0, createUseFetch)()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expect(result).toBeNull()
  })

  it('should return null for logical callee', () => {
    const code = `(ok && createUseFetch)()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expect(result).toBeNull()
  })

  it('should return null for conditional callee', () => {
    const code = `(ok ? createUseFetch : other)()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expect(result).toBeNull()
  })

  it('should return null for `this` member object', () => {
    const code = `this.createUseFetch()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expect(result).toBeNull()
  })

  it('should return null for `super` member object', () => {
    const code = `class A extends B { m(){ super.createUseFetch() } }`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expect(result).toBeNull()
  })

  it('should return null for private field call', () => {
    const code = `class X{ #createUseFetch(){}; f(obj){ obj.#createUseFetch() } }`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expect(result).toBeNull()
  })

  it('should return null for template literal access on namespace', () => {
    const code = 'const x = factories[`createUseFetch`]()'
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expect(result).toBeNull()
  })

  it('should return null for computed binary expression access on namespace', () => {
    const code = 'const x = factories["create" + "UseFetch"]()'
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expect(result).toBeNull()
  })

  it('should return null for identifier template tag', () => {
    const code = 'const x = createUseFetch`tagged`'
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    // TaggedTemplateExpression, not CallExpression
    expect(result).toBeNull()
  })

  it('should return null for constructor call', () => {
    const code = `const x = new createUseFetch()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    // NewExpression, not CallExpression
    expect(result).toBeNull()
  })

  it('should return null for dynamic import', () => {
    const code = `async function f(){ return import('createUseFetch') }`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expect(result).toBeNull()
  })

  it('should handle identifier inside ChainExpression root', () => {
    const code = `createUseFetch?.()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expectFunctionCallMeta(result, { name: 'createUseFetch' })
  })

  it('should return null for multi-level optional chain: pkg?.factories?.createUseFetch()', () => {
    const code = `pkg?.factories?.createUseFetch()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expect(result).toBeNull()
  })

  it('should return null for call made via bind', () => {
    const code = `createUseFetch.bind(null)()`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expect(result).toBeNull()
  })

  it ('should return null for call made via call', () => {
    const code = `createUseFetch.call(null)`
    const result = getFirstParsedFunctionCall(code, /createUseFetch/)
    expect(result).toBeNull()
  })
})

describe('parseExport', () => {
  function getAllParsedExports (code: string, exportedNameFilter?: RegExp) {
    const results: ExportMetadata[] = []

    parseAndWalk(code, 'file.ts', {
      enter (node) {
        if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration' || node.type === 'TSExportAssignment') {
          results.push(...parseStaticExportIdentifiers(node, exportedNameFilter))
        }
      },
    })

    return results
  }

  it('should handle named exports', () => {
    const code = `
      export const a = 1
      export let b = 1
      export var c = 1
      export function d() {}
      export class E {}
      const f = 'f'
      export const foo = () => {}, bar = () => {}
      export const baz = (arg1) => {}
      export { f }
      const g = 'g'
      const h = 'h'
      export { g as renamed, h as default }
    `
    expect(getAllParsedExports(code)).toMatchInlineSnapshot(`
      [
        {
          "exportedName": "a",
          "localName": "a",
        },
        {
          "exportedName": "b",
          "localName": "b",
        },
        {
          "exportedName": "c",
          "localName": "c",
        },
        {
          "exportedName": "d",
          "localName": "d",
        },
        {
          "exportedName": "E",
          "localName": "E",
        },
        {
          "exportedName": "foo",
          "localName": "foo",
        },
        {
          "exportedName": "bar",
          "localName": "bar",
        },
        {
          "exportedName": "baz",
          "localName": "baz",
        },
        {
          "exportedName": "f",
          "localName": "f",
        },
        {
          "exportedName": "renamed",
          "localName": "g",
        },
        {
          "exportedName": "default",
          "localName": "h",
        },
      ]
    `)
  })

  it('should filter out named export exported names', () => {
    const code = `
      export const a = 1
      export const _a = 1
      export let b = 1
      export let _b = 1
      export var c = 1
      export var _c = 1
      export function d() {}
      export function _d() {}
      export class E {}
      export class _E {}
      const f = 'f'
      const _f = 'f'
      export const foo = () => {}, bar = () => {}
      export const _foo = () => {}, _bar = () => {}
      export { f }
      export { _f }
      const g = 'g'
      const _g = 'g'
      export { _g as renamed }
      export { g as _renamed }
    `
    expect(getAllParsedExports(code, /^(?!_).+/)).toMatchInlineSnapshot(`
      [
        {
          "exportedName": "a",
          "localName": "a",
        },
        {
          "exportedName": "b",
          "localName": "b",
        },
        {
          "exportedName": "c",
          "localName": "c",
        },
        {
          "exportedName": "d",
          "localName": "d",
        },
        {
          "exportedName": "E",
          "localName": "E",
        },
        {
          "exportedName": "foo",
          "localName": "foo",
        },
        {
          "exportedName": "bar",
          "localName": "bar",
        },
        {
          "exportedName": "f",
          "localName": "f",
        },
        {
          "exportedName": "renamed",
          "localName": "_g",
        },
      ]
    `)
  })

  it('should handle default export', () => {
    expect(getAllParsedExports('export default function foo() {}')).toMatchInlineSnapshot(`
      [
        {
          "exportedName": "default",
          "localName": "foo",
        },
      ]
    `)
    expect(getAllParsedExports('export default class Foo {}')).toMatchInlineSnapshot(`
      [
        {
          "exportedName": "default",
          "localName": "Foo",
        },
      ]
    `)
    expect(getAllParsedExports('export default () => {}')).toMatchInlineSnapshot(`[]`)
    expect(getAllParsedExports('const foo = \'foo\'; export default foo')).toMatchInlineSnapshot(`
      [
        {
          "exportedName": "default",
          "localName": "foo",
        },
      ]
    `)
    expect(getAllParsedExports('const foo = \'foo\'; export = foo')).toMatchInlineSnapshot(`
      [
        {
          "exportedName": "default",
          "localName": "foo",
        },
      ]
    `)
  })

  it('shouldn\'t filter default export local name', () => {
    const code = `
      const _default = 'default'
      export { _default as default }
    `
    expect(getAllParsedExports(code, /^(?!_).+/)).toMatchInlineSnapshot(`
      [
        {
          "exportedName": "default",
          "localName": "_default",
        },
      ]
    `)

    const code2 = `
      function _foo() {}
      export default _foo
    `
    expect(getAllParsedExports(code2, /^(?!_).+/)).toMatchInlineSnapshot(`
      [
        {
          "exportedName": "default",
          "localName": "_foo",
        },
      ]
    `)

    const code3 = `
      class _Bar {}
      export default _Bar
    `
    expect(getAllParsedExports(code3, /^(?!_).+/)).toMatchInlineSnapshot(`
      [
        {
          "exportedName": "default",
          "localName": "_Bar",
        },
      ]
    `)

    const code4 = `
      export default function _baz() {}
    `
    expect(getAllParsedExports(code4, /^(?!_).+/)).toMatchInlineSnapshot(`
      [
        {
          "exportedName": "default",
          "localName": "_baz",
        },
      ]
    `)
  })

  it('should ignore non-supported exports', () => {
    const code = `
      export const { a, b } = obj
      export const [x, y] = arr
      export default 42
      export { a + b as sum }
      export * from 'module'
      export { a } from 'module'
    `
    expect(getAllParsedExports(code)).toMatchInlineSnapshot(`[]`)
  })

  it('should ignore non-export nodes', () => {
    const code = `
      import { x } from 'module'
      const a = 1
      function f() {}
      class C {}
    `
    expect(getAllParsedExports(code)).toMatchInlineSnapshot(`[]`)
  })

  it('ignores type-exports', () => {
    const code = `
      export type T = { a: number }
      export interface I { b: string }
      type U = number | string
      export type { U }
      export type { U as V }
      export { type U }
      export { type U as V }
    `
    expect(getAllParsedExports(code)).toMatchInlineSnapshot(`[]`)
  })
})
