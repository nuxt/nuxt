import { serializeFunction, normalizeFunctions } from '../src/serialize'

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
      .toEqual('function anonymous(foobar\n) {\nreturn 3;\n}')
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
      fn () {}
    }
    expect(serializeFunction(obj.fn)).toEqual('function() {}')
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
    expect(serializeFunction(obj.fn)).toEqual('foobar => foobar ? 1 : 0')
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
    expect(serializeFunction(obj.fn3)).toEqual('foobar => {\n        return 3;\n      }')
    expect(serializeFunction(obj.fn4)).toEqual('arg1 => 2 * arg1')
  })

  test('should not replace custom scripts', () => {
    const obj = {
      fn () {
        return 'function xyz(){};a=false?true:xyz();'
      }
    }

    expect(serializeFunction(obj.fn)).toEqual(`function () {
        return 'function xyz(){};a=false?true:xyz();';
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

    expect(serializeFunction(obj.fn)).toEqual(`function(arg) {
        if (arg) {
          return {
            title: function () {
              return 'test';
            }

          };
        }
      }`)
  })
})
