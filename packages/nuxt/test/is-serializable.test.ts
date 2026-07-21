import { describe, expect, it } from 'vitest'
import { parseSync } from 'rolldown/utils'
import type { ESTree } from 'rolldown/utils'

import { isSerializable } from '../src/pages/utils.ts'

function parseExpression (source: string): { code: string, node: ESTree.Expression } {
  // Parse as a variable initialiser so a leading `{` isn't ambiguous with a block, and we get the
  // raw expression node rather than a ParenthesizedExpression wrapper.
  const code = `const __x = ${source}`
  const ast = parseSync('test.js', code, { lang: 'js' })
  const decl = ast.program.body[0] as ESTree.VariableDeclaration
  return { code, node: decl.declarations[0]!.init as ESTree.Expression }
}

function check (source: string) {
  const { code, node } = parseExpression(source)
  return isSerializable(code, node)
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
})
