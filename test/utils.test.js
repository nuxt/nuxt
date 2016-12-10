import test from 'ava'
const utils = require('../lib/utils')

test('encodeHtml', t => {
  const html = '<h1>Hello</h1>'
  t.is(utils.encodeHtml(html), '&lt;h1&gt;Hello&lt;/h1&gt;')
})

test('getContext', t => {
  let ctx = utils.getContext({ a: 1 }, { b: 2 })
  t.is(utils.getContext.length, 2)
  t.is(typeof ctx.req, 'object')
  t.is(typeof ctx.res, 'object')
  t.is(ctx.req.a, 1)
  t.is(ctx.res.b, 2)
})

test('waitFor', function * (t) {
  let s = Date.now()
  yield utils.waitFor(100)
  t.true(Date.now() - s >= 100)
})

test('urlJoin', t => {
  t.is(utils.urlJoin('test', '/about'), 'test/about')
})

test('promisifyRouteParams (array)', t => {
  const array = [1]
  const promise = utils.promisifyRouteParams(array)
  t.true(promise instanceof Promise)
  return promise
  .then((res) => {
    t.is(res, array)
  })
})

test('promisifyRouteParams (fn => array)', t => {
  const array = [1, 2]
  const fn = function () {
    return array
  }
  const promise = utils.promisifyRouteParams(fn)
  t.true(promise instanceof Promise)
  return promise
  .then((res) => {
    t.is(res, array)
  })
})

test('promisifyRouteParams (fn => promise)', t => {
  const array = [1, 2, 3]
  const fn = function () {
    return new Promise((resolve) => {
      resolve(array)
    })
  }
  const promise = utils.promisifyRouteParams(fn)
  t.true(promise instanceof Promise)
  return promise
  .then((res) => {
    t.is(res, array)
  })
})

test('promisifyRouteParams (fn(cb) with error)', t => {
  const fn = function (cb) {
    cb('Error here')
  }
  const promise = utils.promisifyRouteParams(fn)
  t.true(promise instanceof Promise)
  return promise
  .catch((e) => {
    t.is(e, 'Error here')
  })
})

test('promisifyRouteParams (fn(cb) with result)', t => {
  const array = [1, 2, 3, 4]
  const fn = function (cb) {
    cb(null, array)
  }
  const promise = utils.promisifyRouteParams(fn)
  t.true(promise instanceof Promise)
  return promise
  .then((res) => {
    t.is(res, array)
  })
})
