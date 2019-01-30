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
