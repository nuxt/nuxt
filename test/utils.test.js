import test from 'ava'
import ansiHTML from 'ansi-html'
import Nuxt from '..'

test('encodeHtml', t => {
  const html = '<h1>Hello</h1>'
  t.is(Nuxt.utils.encodeHtml(html), '&lt;h1&gt;Hello&lt;/h1&gt;')
})

test('getContext', t => {
  let ctx = Nuxt.utils.getContext({ a: 1 }, { b: 2 })
  t.is(Nuxt.utils.getContext.length, 2)
  t.is(typeof ctx.req, 'object')
  t.is(typeof ctx.res, 'object')
  t.is(ctx.req.a, 1)
  t.is(ctx.res.b, 2)
})

test('setAnsiColors', t => {
  Nuxt.utils.setAnsiColors(ansiHTML)
  t.pass()
})

test('waitFor', async (t) => {
  let s = Date.now()
  await Nuxt.utils.waitFor(100)
  t.true(Date.now() - s >= 100)
  await Nuxt.utils.waitFor()
})

test('urlJoin', t => {
  t.is(Nuxt.utils.urlJoin('test', '/about'), 'test/about')
})

test('promisifyRoute (array)', t => {
  const array = [1]
  const promise = Nuxt.utils.promisifyRoute(array)
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
  const promise = Nuxt.utils.promisifyRoute(fn)
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
  const promise = Nuxt.utils.promisifyRoute(fn)
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
  const promise = Nuxt.utils.promisifyRoute(fn)
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
  const promise = Nuxt.utils.promisifyRoute(fn)
  t.is(typeof promise, 'object')
  return promise
  .then((res) => {
    t.is(res, array)
  })
})
