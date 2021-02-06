const { serializeFunction, normalizeFunctions } = require('../src/serialize')

// NOTE: This test file is on purpose using CommonJS syntax to avoid code being
// transformed by 'babel-jest' which affects the results.

const RE_LINE_BREAKS = /[\r\n]+/

describe('util: serialize', () => {
  test('should normalize arrow functions', () => {
    const obj = {
      // eslint-disable-next-line arrow-parens
      fn1: foobar => {},
      fn2: foobar => 1,
      // eslint-disable-next-line arrow-parens
      fn3: foobar => {
        return 3
      },
      // eslint-disable-next-line arrow-parens
      fn4: arg1 =>
        2 * arg1
    }
    expect(normalizeFunctions(obj).fn1.toString())
      .toEqual('function anonymous(foobar\n) {\n\n}')
    expect(normalizeFunctions(obj).fn2.toString())
      .toEqual('function anonymous(foobar\n) {\nreturn 1\n}')
    expect(normalizeFunctions(obj).fn3.toString())
      .toEqual('function anonymous(foobar\n) {\nreturn 3\n}')
    expect(normalizeFunctions(obj).fn4.toString())
      .toEqual('function anonymous(arg1\n) {\nreturn 2 * arg1\n}')
  })

  test('should serialize normal function', () => {
    const obj = {
      fn: function () {} // eslint-disable-line object-shorthand
    }
    expect(serializeFunction(obj.fn)).toEqual('function () {}')
  })

  test('should serialize shorthand function', () => {
    const obj = {
      fn () {},
      // eslint-disable-next-line space-before-function-paren
      $fn() {}
    }
    expect(serializeFunction(obj.fn)).toEqual('function() {}')
    expect(serializeFunction(obj.$fn)).toEqual('function() {}')
  })

  test('should serialize shorthand function with inner arrow function', () => {
    const obj = {
      // eslint-disable-next-line no-unused-vars
      fn () { const _ = rule => rule }
    }
    expect(serializeFunction(obj.fn)).toEqual('function() { const _ = rule => rule }')
  })

  test('should serialize arrow function', () => {
    const obj = {
      fn: () => {}
    }
    expect(serializeFunction(obj.fn)).toEqual('() => {}')
  })

  test('should serialize arrow function with ternary in parens', () => {
    const obj = {
      // eslint-disable-next-line arrow-parens
      fn: foobar => (foobar ? 1 : 0)
    }
    expect(serializeFunction(obj.fn)).toEqual('foobar => (foobar ? 1 : 0)')
  })

  test('should serialize arrow function with single parameter', () => {
    const obj = {
      // eslint-disable-next-line arrow-parens
      fn1: foobar => {},
      fn2: foobar => 1,
      // eslint-disable-next-line arrow-parens
      fn3: foobar => {
        return 3
      },
      // eslint-disable-next-line arrow-parens
      fn4: arg1 =>
        2 * arg1
    }
    expect(serializeFunction(obj.fn1)).toEqual('foobar => {}')
    expect(serializeFunction(obj.fn2)).toEqual('foobar => 1')
    expect(serializeFunction(obj.fn3).replace(RE_LINE_BREAKS, '\n')).toEqual('foobar => {\n        return 3\n      }')
    expect(serializeFunction(obj.fn4).replace(RE_LINE_BREAKS, '\n')).toEqual('arg1 =>\n        2 * arg1')
  })

  test('should not replace custom scripts', () => {
    const obj = {
      fn () {
        return 'function xyz(){};a=false?true:xyz();'
      }
    }

    expect(serializeFunction(obj.fn).replace(RE_LINE_BREAKS, '\n')).toEqual(`function() {
        return 'function xyz(){};a=false?true:xyz();'
      }`)
  })

  test('should serialize internal function', () => {
    const obj = {
      fn (arg) {
        if (arg) {
          return {
            title () {
              return 'test'
            }
          }
        }
      }
    }

    expect(serializeFunction(obj.fn).replace(RE_LINE_BREAKS, '\n')).toEqual(`function(arg) {
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
