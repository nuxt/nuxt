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
