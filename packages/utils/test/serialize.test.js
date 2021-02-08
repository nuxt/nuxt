import { serializeFunction, normalizeFunctions } from '../src/serialize'
import data from './serialize.test.input'

const RE_LINE_BREAKS = /[\r\n]+/g

describe('util: serialize', () => {
  test('should normalize arrow functions', () => {
    const normalized = normalizeFunctions(Object.assign({}, data.arrow))
    expect(normalized.fn1.toString()).toEqual('function anonymous(foobar\n) {\n\n}')
    expect(normalized.fn2.toString()).toEqual('function anonymous(foobar\n) {\nreturn 1\n}')
    expect(normalized.fn3.toString()).toEqual('function anonymous(foobar\n) {\nreturn 3\n}')
    expect(normalized.fn4.toString()).toEqual('function anonymous(arg1\n) {\nreturn 2 * arg1\n}')
  })

  test('should serialize normal function', () => {
    const obj = Object.assign({}, data.normal)
    expect(serializeFunction(obj.fn)).toEqual('function () {}')
  })

  test('should serialize shorthand function', () => {
    const obj = Object.assign({}, data.shorthand)
    expect(serializeFunction(obj.fn)).toEqual('function() {}')
    expect(serializeFunction(obj.$fn)).toEqual('function() {}')
    expect(serializeFunction(obj.fn_arrow)).toEqual('function() { const _ = rule => rule }')
  })

  test('should serialize arrow function', () => {
    const obj = Object.assign({}, data.arrow)
    expect(serializeFunction(obj.fn5)).toEqual('() => {}')
  })

  test('should serialize arrow function with ternary in parens', () => {
    const obj = Object.assign({}, data.arrow)
    expect(serializeFunction(obj.fn6)).toEqual('foobar => (foobar ? 1 : 0)')
  })

  test('should serialize arrow function with single parameter', () => {
    const obj = Object.assign({}, data.arrow)
    expect(serializeFunction(obj.fn1)).toEqual('foobar => {}')
    expect(serializeFunction(obj.fn2)).toEqual('foobar => 1')
    expect(serializeFunction(obj.fn3).replace(RE_LINE_BREAKS, '\n')).toEqual(`foobar => {
      return 3
    }`)
    expect(serializeFunction(obj.fn4).replace(RE_LINE_BREAKS, '\n')).toEqual(`arg1 =>
      2 * arg1`)
  })

  test('should not replace custom scripts', () => {
    const obj = Object.assign({}, data.shorthand)

    expect(serializeFunction(obj.fn_script).replace(RE_LINE_BREAKS, '\n')).toEqual(`function() {
      return 'function xyz(){};a=false?true:xyz();'
    }`)
  })

  test('should serialize internal function', () => {
    const obj = Object.assign({}, data.shorthand)

    expect(serializeFunction(obj.fn_internal).replace(RE_LINE_BREAKS, '\n')).toEqual(`function(arg) {
      if (arg) {
        return {
          title: function () {
            return 'test'
          }
        }
      }
    }`)
  })
})
