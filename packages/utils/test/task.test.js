import consola from 'consola'
import { sequence, parallel, chainFn } from '../src/task'

describe('util: task', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should call fn in sequence', async () => {
    const fn = jest.fn(consola.log)
    await sequence([1, 2, 3, 4], fn)

    expect(fn).toBeCalledTimes(4)
    expect(consola.log).toBeCalledTimes(4)
    expect(consola.log).nthCalledWith(1, 1)
    expect(consola.log).nthCalledWith(2, 2)
    expect(consola.log).nthCalledWith(3, 3)
    expect(consola.log).nthCalledWith(4, 4)
  })

  test('should call fn in parallel', async () => {
    jest.spyOn(Promise, 'all')
    jest.spyOn(Promise, 'resolve')

    await parallel([1, 2, 3, 4], (num, index) => [num, index])

    expect(Promise.all).toBeCalledTimes(1)
    expect(Promise.resolve).toBeCalledTimes(4)
    expect(Promise.resolve).nthCalledWith(1, [1, 0])
    expect(Promise.resolve).nthCalledWith(2, [2, 1])
    expect(Promise.resolve).nthCalledWith(3, [3, 2])
    expect(Promise.resolve).nthCalledWith(4, [4, 3])

    Promise.all.mockRestore()
    Promise.resolve.mockRestore()
  })

  test('chainFn (mutate, mutate)', () => {
    // Pass more than one argument to test that they're actually taken into account
    const firstFn = function (obj, count) {
      obj.foo = count + 1
    }
    const secondFn = function (obj, count) {
      obj.bar = count + 2
    }

    const chainedFn = chainFn(firstFn, secondFn)
    expect(chainedFn({}, 10)).toEqual({ foo: 11, bar: 12 })
  })

  test('chainFn (mutate, return)', () => {
    const firstFn = function (obj, count) {
      obj.foo = count + 1
    }
    const secondFn = function (obj, count) {
      return Object.assign({}, obj, { bar: count + 2 })
    }

    const chainedFn = chainFn(firstFn, secondFn)
    expect(chainedFn({}, 10)).toEqual({ foo: 11, bar: 12 })
  })

  test('chainFn (return, mutate)', () => {
    const firstFn = function (obj, count) {
      return Object.assign({}, obj, { foo: count + 1 })
    }
    const secondFn = function (obj, count) {
      obj.bar = count + 2
    }

    const chainedFn = chainFn(firstFn, secondFn)
    expect(chainedFn({}, 10)).toEqual({ foo: 11, bar: 12 })
  })

  test('chainFn (return, return)', () => {
    const firstFn = function (obj, count) {
      return Object.assign({}, obj, { foo: count + 1 })
    }
    const secondFn = function (obj, count) {
      return Object.assign({}, obj, { bar: count + 2 })
    }

    const chainedFn = chainFn(firstFn, secondFn)
    expect(chainedFn({}, 10)).toEqual({ foo: 11, bar: 12 })
  })

  test('chainFn (return, non-function)', () => {
    const firstFn = function (obj, count) {
      return Object.assign({}, obj, { foo: count + 1 })
    }
    const secondFn = ''

    const chainedFn = chainFn(firstFn, secondFn)
    expect(chainedFn).toBe(firstFn)
  })

  test('chainFn (non-function, return)', () => {
    const firstFn = ''
    const secondFn = function (obj, count) {
      return Object.assign({}, obj, { bar: count + 2 })
    }

    const chainedFn = chainFn(firstFn, secondFn)
    expect(chainedFn({}, 10)).toEqual({ bar: 12 })
  })

  test('chainFn (promise)', async () => {
    const firstFn = () => Promise.resolve({ foo: 1 })
    const secondFn = function (obj) {
      obj.foo++
      return Promise.resolve()
    }

    const chainedFn = chainFn(firstFn, secondFn)
    expect(await chainedFn()).toEqual({ foo: 2 })
  })
})
