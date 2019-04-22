import { serializeFunction } from '../src/serialize'

describe('util: serialize', () => {
  test('should serialize normal function', () => {
    const obj = {
      fn: function () {}
    }
    expect(serializeFunction(obj.fn)).toEqual('function () {}')
  })

  test('should serialize shorthand function', () => {
    const obj = {
      fn() {}
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
      fn: foobar => {},
      fn2: foobar => 1,
      fn3: foobar => {
        return 3
      }
    }
    expect(serializeFunction(obj.fn)).toEqual('foobar => {}')
    expect(serializeFunction(obj.fn2)).toEqual('foobar => 1')
    expect(serializeFunction(obj.fn3)).toEqual('foobar => {\n        return 3;\n      }')
  })

  test('should not replace custom scripts', () => {
    const obj = {
      fn() {
        return 'function xyz(){};a=false?true:xyz();'
      }
    }

    expect(serializeFunction(obj.fn)).toEqual(`function () {
        return 'function xyz(){};a=false?true:xyz();';
      }`)
  })

  test('should serialize internal function', () => {
    const obj = {
      fn(arg) {
        if (arg) {
          return {
            title() {
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
