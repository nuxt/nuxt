import test from 'ava'
import stdMocks from 'std-mocks'
import { Nuxt, Builder } from '../index.js'

let nuxt = null

const port = 4004
const url = (route) => 'http://localhost:' + port + route

const renderRoute = async _url => {
  const window = await nuxt.renderAndGetWindow(url(_url))
  const head = window.document.head.innerHTML
  const html = window.document.body.innerHTML
  return { window, head, html }
}

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  nuxt = new Nuxt(require('./fixtures/spa/nuxt.config'))
  await new Builder(nuxt).build()
  await nuxt.listen(port, 'localhost')
})

test('/ (basic spa)', async t => {
  const { html } = await renderRoute('/')
  t.true(html.includes('Hello SPA!'))
})

test('/custom (custom layout)', async t => {
  const { html } = await renderRoute('/custom')
  t.true(html.includes('Custom layout'))
})

test('/custom (not default layout)', async t => {
  const { head } = await renderRoute('/custom')
  t.false(head.includes('src="/_nuxt/layouts/default.'))
})

test('/custom (call mounted and created once)', async t => {
  stdMocks.use()
  await renderRoute('/custom')
  stdMocks.restore()
  const output = stdMocks.flush()
  const creates = output.stdout.filter(value => value === 'created\n')
  t.true(creates.length === 1)
  const mounts = output.stdout.filter(value => value === 'mounted\n')
  t.true(mounts.length === 1)
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  nuxt.close()
})
