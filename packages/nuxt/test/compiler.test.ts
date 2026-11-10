import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { defineKeyedFunctionFactory } from '../src/compiler/runtime'
import { parseStaticExportIdentifiers, parseStaticFunctionCall } from '../src/core/utils/parse-utils.ts'
import type { FunctionCallMetadata } from '../src/core/utils/parse-utils.ts'
import { createScanPluginContext } from '../src/compiler/utils.ts'
import * as oxcWalker from 'oxc-walker'
import { ScopeTracker, parseAndWalk } from 'oxc-walker'

vi.mock('oxc-walker', async importOriginal => ({ ...await importOriginal() }))

function transformFactory<T extends (...args: any[]) => any> (factory: T): T {
  return (factory as unknown as { __nuxt_factory: T }).__nuxt_factory
}

describe('defineKeyedFunctionFactory', () => {
  const fn = (a: string, b: number): string => {
    return `${a}-${b}-value`
  }

  it('should produce factory that throws when not transformed', () => {
    const factory = defineKeyedFunctionFactory({
      name: 'createUseFetch',
      factory: fn,
    })

    expect(() => factory('a', 1)).toThrowErrorMatchingInlineSnapshot(`[NUXT_E1007: https://nuxt.com/docs/5.x/errors/e1007]`)
  })

  it('should expose the factory function on a non-enumerable `__nuxt_factory` property', () => {
    const factory = defineKeyedFunctionFactory({
      name: 'createUseFetch',
      factory: fn,
    })

    expect(Object.getOwnPropertyDescriptor(factory, '__nuxt_factory')?.enumerable).toBe(false)
    expect(Object.keys(factory)).not.toContain('__nuxt_factory')
    expect(transformFactory(factory)).toBe(fn)
    expect(transformFactory(factory)('a', 1)).toBe('a-1-value')

    const errorFactory = defineKeyedFunctionFactory({
      name: 'errorFactory',
      factory: () => { throw new Error('Factory error') },
    })
    expect(() => transformFactory(errorFactory)()).toThrow('Factory error')
  })

  it('should preserve parameter and return types', () => {
    type Args = [id: string, label: string, options?: { silent?: boolean }]
    type Ret = { id: number, label: string, ok: true }

    const fn = (..._args: Args): Ret => {
      return undefined as unknown as Ret
    }

    const factory = defineKeyedFunctionFactory({
      name: 'createUseFetch',
      factory: fn,
    })

    expectTypeOf(factory).not.toBeAny()
    expectTypeOf(factory).toEqualTypeOf<typeof fn>()
    expectTypeOf(factory).parameters.toEqualTypeOf<Args>()
    expectTypeOf(factory).returns.toEqualTypeOf<Ret>()
  })

  it('should work with generics in the real factory', () => {
    const fn = <T extends { id: string }>(entity: T, flag: boolean) => {
      return { entity, flag, kind: 'ok' as const }
    }

    const generic = defineKeyedFunctionFactory({
      name: 'createGeneric',
      factory: fn,
    })

    expectTypeOf(generic).toBeCallableWith({ id: 'x' }, true)
    expectTypeOf(generic).parameter(0).toEqualTypeOf<{ id: string }>()

    const transformed = transformFactory(generic)
    expectTypeOf(transformed<{ id: 'a' }>({ id: 'a' }, true)).toMatchObjectType<{ entity: { id: 'a' }, flag: boolean, kind: 'ok' }>()
  })
})

describe('createScanPluginContext', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should parse once and share the result between walks', () => {
    const parseAndWalk = vi.spyOn(oxcWalker, 'parseAndWalk')
    const walk = vi.spyOn(oxcWalker, 'walk')
    const context = createScanPluginContext('const a: number = 1', 'file.ts')

    const scopeTracker = new ScopeTracker()
    const declarations: string[] = []
    const first = context.walkParsed({
      scopeTracker,
      enter (node) {
        if (node.type === 'Identifier') {
          declarations.push(`${node.name}:${scopeTracker.getDeclaration(node.name)?.type}`)
        }
      },
    })
    expect(declarations).toEqual(['a:Variable'])

    const types: string[] = []
    const second = context.walkParsed({ enter: node => types.push(node.type) })
    expect(second).toBe(first)
    expect(types).toContain('VariableDeclarator')
    expect(parseAndWalk).toHaveBeenCalledTimes(1)
    expect(walk).toHaveBeenCalledTimes(1)
  })
})

describe('parseStaticFunctionCall', () => {
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

  function describeNode (node: FunctionCallMetadata['node']) {
    if (node.type === 'Identifier') { return node.name }
    if (node.type === 'MemberExpression') { return `[${node.property.type === 'Literal' ? node.property.value : ''}]` }
    return node.type
  }

  it.each([
    ['useFetch(\'key\')', 'useFetch', null, 'useFetch'],
    ['useFetch()', 'useFetch', null, 'useFetch'],
    ['factories.createUseFetch()', 'createUseFetch', 'factories', 'createUseFetch'],
    ['factories[\'createUseFetch\']()', 'createUseFetch', 'factories', '[createUseFetch]'],
    ['factories?.createUseFetch?.()', 'createUseFetch', 'factories', 'createUseFetch'],
    ['factories?.[\'createUseFetch\']?.()', 'createUseFetch', 'factories', '[createUseFetch]'],
    ['factories?.[\'createUseFetch\']()', 'createUseFetch', 'factories', '[createUseFetch]'],
    ['async function f(){ return await createUseFetch() }', 'createUseFetch', null, 'createUseFetch'],
    ['async function f(){ return await factories?.createUseFetch?.() }', 'createUseFetch', 'factories', 'createUseFetch'],
    ['const s = `${factories.createUseFetch()}`', 'createUseFetch', 'factories', 'createUseFetch'],
    ['const y = (factories.createUseFetch())(\'key\')', 'createUseFetch', 'factories', 'createUseFetch'],
    ['(createUseFetch)()', 'createUseFetch', null, 'ParenthesizedExpression'],
    ['(createUseFetch)?.()', 'createUseFetch', null, 'ParenthesizedExpression'],
    ['(factories.createUseFetch)?.()', 'createUseFetch', 'factories', 'ParenthesizedExpression'],
    ['(createUseFetch as any)()', 'createUseFetch', null, 'ParenthesizedExpression'],
    ['(factories as any).createUseFetch()', 'createUseFetch', 'factories', 'createUseFetch'],
    ['(factories.createUseFetch as any)()', 'createUseFetch', 'factories', 'ParenthesizedExpression'],
    ['(createUseFetch!)()', 'createUseFetch', null, 'ParenthesizedExpression'],
    ['(factories!).createUseFetch()', 'createUseFetch', 'factories', 'createUseFetch'],
    ['(factories.createUseFetch!)()', 'createUseFetch', 'factories', 'ParenthesizedExpression'],
    ['(<any>createUseFetch)()', 'createUseFetch', null, 'ParenthesizedExpression'],
    ['(<any>factories).createUseFetch()', 'createUseFetch', 'factories', 'createUseFetch'],
    ['(<any>factories.createUseFetch)()', 'createUseFetch', 'factories', 'ParenthesizedExpression'],
    ['class C{ static createUseFetch(){} } C.createUseFetch()', 'createUseFetch', 'C', 'createUseFetch'],
    ['createUseFetch?.()', 'createUseFetch', null, 'createUseFetch'],
  ])('should parse `%s`', (code, name, namespace, node) => {
    const result = getFirstParsedFunctionCall(code, /createUseFetch|useFetch/)
    expect(result && { name: result.name, namespace: result.namespace, node: describeNode(result.node), call: result.callExpression.type })
      .toEqual({ name, namespace, node, call: 'CallExpression' })
  })

  it.each([
    [/^createUseFetch$/, 'factories.createUseFetch()'],
    // global regexes must not depend on `lastIndex`
    [/createUseFetch/g, 'createUseFetch(); createUseFetch();'],
  ])('should match with filter %s', (filter, code) => {
    expect(getFirstParsedFunctionCall(code, filter)?.name).toBe('createUseFetch')
  })

  it.each([
    'createUseFetchX(); factories.createUseFetchX(); factories[\'createUseFetchX\']()',
    'fn(); other();',
    'const x = getFactory().createUseFetch()',
    'const x = pkg.factories.createUseFetch()',
    'const x = (ok ? factories.createUseFetch : noop)()',
    '(0, createUseFetch)()',
    '(ok && createUseFetch)()',
    '(ok ? createUseFetch : other)()',
    'this.createUseFetch()',
    'class A extends B { m(){ super.createUseFetch() } }',
    'class X{ #createUseFetch(){}; f(obj){ obj.#createUseFetch() } }',
    'const x = factories[`createUseFetch`]()',
    'const x = factories["create" + "UseFetch"]()',
    'const x = createUseFetch`tagged`',
    'const x = new createUseFetch()',
    'async function f(){ return import(\'createUseFetch\') }',
    'pkg?.factories?.createUseFetch()',
    'createUseFetch.bind(null)()',
    'createUseFetch.call(null)',
  ])('should not parse `%s`', (code) => {
    expect(getFirstParsedFunctionCall(code, /\bcreateUseFetch\b/)).toBeNull()
  })
})

describe('parseStaticExportIdentifiers', () => {
  function getAllParsedExports (code: string, exportedNameFilter?: RegExp) {
    const results: string[] = []

    parseAndWalk(code, 'file.ts', {
      enter (node) {
        if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration' || node.type === 'TSExportAssignment') {
          results.push(...parseStaticExportIdentifiers(node, exportedNameFilter).map(e => e.localName === e.exportedName ? e.localName : `${e.localName} as ${e.exportedName}`))
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
    expect(getAllParsedExports(code)).toEqual(['a', 'b', 'c', 'd', 'E', 'foo', 'bar', 'baz', 'f', 'g as renamed', 'h as default'])
  })

  it('should filter named exports by exported name', () => {
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
    expect(getAllParsedExports(code, /^(?!_).+/)).toEqual(['a', 'b', 'c', 'd', 'E', 'foo', 'bar', 'f', '_g as renamed'])
  })

  it.each([
    ['export default function foo() {}', ['foo as default']],
    ['export default class Foo {}', ['Foo as default']],
    ['export default () => {}', []],
    ['const foo = \'foo\'; export default foo', ['foo as default']],
    ['const foo = \'foo\'; export = foo', ['foo as default']],
  ])('should handle default export `%s`', (code, expected) => {
    expect(getAllParsedExports(code)).toEqual(expected)
  })

  it.each([
    ['const _default = \'default\'; export { _default as default }', '_default'],
    ['function _foo() {}; export default _foo', '_foo'],
    ['class _Bar {}; export default _Bar', '_Bar'],
    ['export default function _baz() {}', '_baz'],
  ])('should not filter default export `%s` by its local name', (code, local) => {
    expect(getAllParsedExports(code, /^(?!_).+/)).toEqual([`${local} as default`])
  })

  it.each([
    ['unsupported exports', `
      export const { a, b } = obj
      export const [x, y] = arr
      export default 42
      export { a + b as sum }
      export * from 'module'
      export { a } from 'module'
    `],
    ['non-export nodes', `
      import { x } from 'module'
      const a = 1
      function f() {}
      class C {}
    `],
    ['type exports', `
      export type T = { a: number }
      export interface I { b: string }
      type U = number | string
      export type { U }
      export type { U as V }
      export { type U }
      export { type U as V }
    `],
  ])('should ignore %s', (_, code) => {
    expect(getAllParsedExports(code)).toEqual([])
  })
})
