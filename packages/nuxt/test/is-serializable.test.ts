import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { parseSync } from 'rolldown/utils'
import type { ESTree } from 'rolldown/utils'

import { isSerializable } from '../src/pages/utils.ts'

function parseExpression (source: string): ESTree.Expression {
  // Parse as a variable initialiser so a leading `{` isn't ambiguous with a block, and we get the
  // raw expression node rather than a ParenthesizedExpression wrapper.
  const ast = parseSync('test.js', `const __x = ${source}`, { lang: 'js' })
  const decl = ast.program.body[0] as ESTree.VariableDeclaration
  return decl.declarations[0]!.init as ESTree.Expression
}

function check (source: string) {
  return isSerializable(parseExpression(source))
}

describe('isSerializable', () => {
  it('accepts a plain literal object', () => {
    expect(check(`{ foo: 'bar', baz: 1, qux: true, quux: null }`)).toEqual({
      value: { foo: 'bar', baz: 1, qux: true, quux: null },
      serializable: true,
    })
  })

  it('accepts a nested object containing an array', () => {
    expect(check(`{ a: { b: [1, 2, 3] } }`)).toEqual({
      value: { a: { b: [1, 2, 3] } },
      serializable: true,
    })
  })

  it('accepts signed numeric literals', () => {
    expect(check(`{ x: -1, y: +2 }`)).toEqual({
      value: { x: -1, y: 2 },
      serializable: true,
    })
  })

  it('accepts string-keyed properties', () => {
    expect(check(`{ 'foo-bar': 1, '123': 'baz' }`)).toEqual({
      value: { 'foo-bar': 1, '123': 'baz' },
      serializable: true,
    })
  })

  it('rejects identifier references', () => {
    expect(check(`{ foo: bar }`)).toEqual({ serializable: false })
  })

  it('rejects call expressions', () => {
    expect(check(`{ foo: bar() }`)).toEqual({ serializable: false })
  })

  it('rejects spread elements in objects', () => {
    expect(check(`{ ...rest }`)).toEqual({ serializable: false })
  })

  it('rejects spread elements in arrays', () => {
    expect(check(`[1, ...rest, 3]`)).toEqual({ serializable: false })
  })

  it('rejects computed keys', () => {
    expect(check(`{ [k]: 1 }`)).toEqual({ serializable: false })
  })

  it('rejects template literals', () => {
    expect(check('{ foo: `hello` }')).toEqual({ serializable: false })
  })

  it('rejects regex literals', () => {
    expect(check(`{ foo: /x/ }`)).toEqual({ serializable: false })
  })

  it('rejects bigint literals', () => {
    expect(check(`{ foo: 1n }`)).toEqual({ serializable: false })
  })

  it('rejects method shorthand', () => {
    expect(check(`{ foo () {} }`)).toEqual({ serializable: false })
  })

  it('rejects getters', () => {
    expect(check(`{ get foo () { return 1 } }`)).toEqual({ serializable: false })
  })

  it('rejects setters', () => {
    expect(check(`{ set foo (v) {} }`)).toEqual({ serializable: false })
  })

  it('rejects sparse arrays', () => {
    expect(check(`[1, , 3]`)).toEqual({ serializable: false })
  })

  it('rejects unary operators other than + and -', () => {
    expect(check(`{ x: !true }`)).toEqual({ serializable: false })
    expect(check(`{ x: ~1 }`)).toEqual({ serializable: false })
  })

  it('rejects signed non-numeric literals', () => {
    expect(check(`{ x: -'foo' }`)).toEqual({ serializable: false })
  })

  it('rejects arrow function values', () => {
    expect(check(`{ foo: () => 1 }`)).toEqual({ serializable: false })
  })

  it('keeps a `__proto__` key as an own property', () => {
    const { serializable, value } = check(`{ __proto__: { polluted: true } }`)
    expect(serializable).toBe(true)
    expect(JSON.stringify(value)).toBe(`{"__proto__":{"polluted":true}}`)
    expect(value.polluted).toBeUndefined()
  })

  const objectKey = fc.oneof(fc.string(), fc.constantFrom('__proto__', 'constructor', 'toString', 'a', '0', '1e3'))
  const jsonValue = fc.letrec<{ value: unknown }>(tie => ({
    value: fc.oneof(
      { weight: 6, arbitrary: fc.oneof(fc.string(), fc.integer(), fc.double({ noNaN: true, noDefaultInfinity: true }), fc.boolean(), fc.constant(null)) },
      { weight: 1, arbitrary: fc.array(tie('value'), { maxLength: 3 }) },
      { weight: 1, arbitrary: fc.dictionary(objectKey, tie('value'), { maxKeys: 3 }) },
    ),
  })).value

  it('should round-trip any JSON value printed as a literal', () => {
    fc.assert(fc.property(jsonValue, (value) => {
      const json = JSON.stringify(value)
      const { serializable, value: extracted } = check(json)
      expect(serializable).toBe(true)
      expect(extracted).toEqual(JSON.parse(json))
      expect(JSON.stringify(extracted)).toBe(json)
    }), { numRuns: 1000 })
  })
})
