import test from 'ava'
import ansiHTML from 'ansi-html'
import { Utils } from '..'

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

test('waitFor', async t => {
  let s = Date.now()
  await Utils.waitFor(100)
  t.true(Date.now() - s >= 100)
  await Utils.waitFor()
})

test('timeout (promise)', async t => {
  const result = await Utils.timeout(Promise.resolve('time not run out'), 100)
  t.is(result, 'time not run out')
})

test('timeout (async function)', async t => {
  const result = await Utils.timeout(async () => {
    await Utils.waitFor(10)
    return 'time not run out'
  }, 100)
  t.is(result, 'time not run out')
})

test('timeout (timeout in 100ms)', async t => {
  const timeout = Utils.timeout(Utils.waitFor(200), 100, 'timeout test 100ms')
  const { message } = await t.throws(timeout)
  t.is(message, 'timeout test 100ms')
})

test('timeout (async timeout in 100ms)', async t => {
  const timeout = Utils.timeout(async () => {
    await Utils.waitFor(500)
  }, 100, 'timeout test 100ms')
  const { message } = await t.throws(timeout)
  t.is(message, 'timeout test 100ms')
})

test('urlJoin', t => {
  t.is(Utils.urlJoin('test', '/about'), 'test/about')
})

test('promisifyRoute (array)', t => {
  const array = [1]
  const promise = Utils.promisifyRoute(array)
  t.is(typeof promise, 'object')
  return promise.then(res => {
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
  return promise.then(res => {
    t.is(res, array)
  })
})

test('promisifyRoute (fn => promise)', t => {
  const array = [1, 2, 3]
  const fn = function () {
    return new Promise(resolve => {
      resolve(array)
    })
  }
  const promise = Utils.promisifyRoute(fn)
  t.is(typeof promise, 'object')
  return promise.then(res => {
    t.is(res, array)
  })
})

test('promisifyRoute ((fn(args) => promise))', t => {
  const fn = function (array) {
    return new Promise(resolve => {
      resolve(array)
    })
  }
  const array = [1, 2, 3]
  const promise = Utils.promisifyRoute(fn, array)
  t.is(typeof promise, 'object')
  return promise.then(res => {
    t.is(res, array)
  })
})

test('promisifyRoute (fn(cb) with error)', t => {
  const fn = function (cb) {
    cb(new Error('Error here'))
  }
  const promise = Utils.promisifyRoute(fn)
  t.is(typeof promise, 'object')
  return promise.catch(e => {
    t.is(e.message, 'Error here')
  })
})

test('promisifyRoute (fn(cb, args) with error)', t => {
  const fn = function (cb, array) {
    cb(new Error('Error here: ' + array.join()))
  }
  const array = [1, 2, 3, 4]
  const promise = Utils.promisifyRoute(fn, array)
  t.is(typeof promise, 'object')
  return promise.catch(e => {
    t.is(e.message, 'Error here: ' + array.join())
  })
})

test('promisifyRoute (fn(cb) with result)', t => {
  const array = [1, 2, 3, 4]
  const fn = function (cb) {
    cb(null, array)
  }
  const promise = Utils.promisifyRoute(fn)
  t.is(typeof promise, 'object')
  return promise.then(res => {
    t.is(res, array)
  })
})

test('promisifyRoute (fn(cb, args) with result)', t => {
  const fn = function (cb, array, object) {
    cb(null, { array, object })
  }
  const array = [1, 2, 3, 4]
  const object = { a: 1 }
  const promise = Utils.promisifyRoute(fn, array, object)
  t.is(typeof promise, 'object')
  return promise.then(res => {
    t.is(res.array, array)
    t.is(res.object, object)
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
