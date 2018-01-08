import test from 'ava'
import { resolve } from 'path'
import { Nuxt, Builder } from '..'
import { interceptLog, release } from './helpers/console'

let nuxt = null

const port = 4012
const url = (route) => 'http://localhost:' + port + route

const renderRoute = async _url => {
  const window = await nuxt.renderAndGetWindow(url(_url))
  const head = window.document.head.innerHTML
  const html = window.document.body.innerHTML
  return { window, head, html }
}

// Init nuxt.js and create server listening on localhost:4000
test.serial('Init Nuxt.js', async t => {
  const rootDir = resolve(__dirname, 'fixtures/spa')
  const config = require(resolve(rootDir, 'nuxt.config.js'))
  config.rootDir = rootDir

  const logSpy = await interceptLog(async () => {
    nuxt = new Nuxt(config)
    await new Builder(nuxt).build()
    await nuxt.listen(port, 'localhost')
  })

  t.true(logSpy.calledWithMatch('DONE'))
  t.true(logSpy.calledWithMatch('OPEN'))
})

test.serial('/ (basic spa)', async t => {
  const logSpy = await interceptLog()
  const { html } = await renderRoute('/')
  t.true(html.includes('Hello SPA!'))
  release()
  t.true(logSpy.withArgs('created').notCalled)
  t.true(logSpy.withArgs('mounted').calledOnce)
})

test.serial('/custom (custom layout)', async t => {
  const logSpy = await interceptLog()
  const { html } = await renderRoute('/custom')
  t.true(html.includes('Custom layout'))
  release()
  t.true(logSpy.withArgs('created').calledOnce)
  t.true(logSpy.withArgs('mounted').calledOnce)
})

test.serial('/custom (not default layout)', async t => {
  const logSpy = await interceptLog()
  const { head } = await renderRoute('/custom')
  t.false(head.includes('src="/_nuxt/layouts/default.'))
  release()
  t.true(logSpy.withArgs('created').calledOnce)
  t.true(logSpy.withArgs('mounted').calledOnce)
})

test.serial('/custom (call mounted and created once)', async t => {
  const logSpy = await interceptLog()
  await renderRoute('/custom')
  release()
  t.true(logSpy.withArgs('created').calledOnce)
  t.true(logSpy.withArgs('mounted').calledOnce)
})

test.serial('/mounted', async t => {
  const { html } = await renderRoute('/mounted')

  t.true(html.includes('<h1>Test: updated</h1>'))
})

test('/_nuxt/ (access publicPath in spa mode)', async t => {
  const { response: { statusCode, statusMessage } } = await t.throws(renderRoute('/_nuxt/'))
  t.is(statusCode, 404)
  t.is(statusMessage, 'ResourceNotFound')
})

// Close server and ask nuxt to stop listening to file changes
test.after.always('Closing server and nuxt.js', async t => {
  await nuxt.close()
})
