import test from 'ava'
import ansiHTML from 'ansi-html'
import { Utils } from '../index.js'

test('encodeHtml', t => {
  const html = '<h1>Hello</h1>'
  t.is(Utils.encodeHtml(html), '&lt;h1&gt;Hello&lt;/h1&gt;')
})

test('getContext', t => {
  let ctx = Utils.getContext({ a: 1 }, { b: 2 })
  t.is(Utils.getContext.length, 2)
  t.is(typeof ctx.req, 'object')
  t.is(typeof ctx.res, 'object')
  t.is(ctx.req.a, 1)
  t.is(ctx.res.b, 2)
})

test('setAnsiColors', t => {
  Utils.setAnsiColors(ansiHTML)
  t.pass()
})

test('waitFor', async (t) => {
  let s = Date.now()
  await Utils.waitFor(100)
  t.true(Date.now() - s >= 100)
  await Utils.waitFor()
})

test('urlJoin', t => {
  t.is(Utils.urlJoin('test', '/about'), 'test/about')
})

test('promisifyRoute (array)', t => {
  const array = [1]
  const promise = Utils.promisifyRoute(array)
  t.is(typeof promise, 'object')
  return promise
    .then((res) => {
      t.is(res, array)
    })
})

test('promisifyRoute (fn => array)', t => {
  const array = [1, 2]
  const fn = function () {
    return array
  }
  const promise = Utils.promisifyRoute(fn)
  t.is(typeof promise, 'object')
  return promise
    .then((res) => {
      t.is(res, array)
    })
})

test('promisifyRoute (fn => promise)', t => {
  const array = [1, 2, 3]
  const fn = function () {
    return new Promise((resolve) => {
      resolve(array)
    })
  }
  const promise = Utils.promisifyRoute(fn)
  t.is(typeof promise, 'object')
  return promise
    .then((res) => {
      t.is(res, array)
    })
})

test('promisifyRoute (fn(cb) with error)', t => {
  const fn = function (cb) {
    cb(new Error('Error here'))
  }
  const promise = Utils.promisifyRoute(fn)
  t.is(typeof promise, 'object')
  return promise
    .catch((e) => {
      t.is(e.message, 'Error here')
    })
})

test('promisifyRoute (fn(cb) with result)', t => {
  const array = [1, 2, 3, 4]
  const fn = function (cb) {
    cb(null, array)
  }
  const promise = Utils.promisifyRoute(fn)
  t.is(typeof promise, 'object')
  return promise
    .then((res) => {
      t.is(res, array)
    })
})

test('chainFn (mutate, mutate)', t => {
  // Pass more than one argument to test that they're actually taken into account
  const firstFn = function (obj, count) {
    obj.foo = count + 1
  }
  const secondFn = function (obj, count) {
    obj.bar = count + 2
  }
  const chainedFn = Utils.chainFn(firstFn, secondFn)
  const expectedResult = { foo: 11, bar: 12 }
  t.deepEqual(chainedFn({}, 10), expectedResult)
})

test('chainFn (mutate, return)', t => {
  const firstFn = function (obj, count) {
    obj.foo = count + 1
  }
  const secondFn = function (obj, count) {
    return Object.assign({}, obj, { bar: count + 2 })
  }
  const chainedFn = Utils.chainFn(firstFn, secondFn)
  const expectedResult = { foo: 11, bar: 12 }
  t.deepEqual(chainedFn({}, 10), expectedResult)
})

test('chainFn (return, mutate)', t => {
  const firstFn = function (obj, count) {
    return Object.assign({}, obj, { foo: count + 1 })
  }
  const secondFn = function (obj, count) {
    obj.bar = count + 2
  }
  const chainedFn = Utils.chainFn(firstFn, secondFn)
  const expectedResult = { foo: 11, bar: 12 }
  t.deepEqual(chainedFn({}, 10), expectedResult)
})

test('chainFn (return, return)', t => {
  const firstFn = function (obj, count) {
    return Object.assign({}, obj, { foo: count + 1 })
  }
  const secondFn = function (obj, count) {
    return Object.assign({}, obj, { bar: count + 2 })
  }
  const chainedFn = Utils.chainFn(firstFn, secondFn)
  const expectedResult = { foo: 11, bar: 12 }
  t.deepEqual(chainedFn({}, 10), expectedResult)
})
