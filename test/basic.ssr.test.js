import test from 'ava'
import { resolve } from 'path'
import rp from 'request-promise-native'
import { Nuxt, Builder } from '../index.js'
import { interceptLog, interceptError } from './helpers/console'

const port = 4003
const url = (route) => 'http://localhost:' + port + route

let nuxt = null

// Init nuxt.js and create server listening on localhost:4003
test.before('Init Nuxt.js', async t => {
  const options = {
    rootDir: resolve(__dirname, 'fixtures/basic'),
    dev: false,
    head: {
      titleTemplate(titleChunk) {
        return titleChunk ? `${titleChunk} - Nuxt.js` : 'Nuxt.js'
      }
    }
  }

  await interceptLog('building nuxt', async () => {
    nuxt = new Nuxt(options)
    await new Builder(nuxt).build()
    await nuxt.listen(port, 'localhost')
  })
})

test('/stateless', async t => {
  const { html } = await nuxt.renderRoute('/stateless')
  t.true(html.includes('<h1>My component!</h1>'))
})

/*
** Example of testing via dom checking
*/
test('/css', async t => {
  const window = await nuxt.renderAndGetWindow(url('/css'))
  const element = window.document.querySelector('.red')
  t.not(element, null)
  t.is(element.textContent, 'This is red')
  t.is(element.className, 'red')
  t.is(window.getComputedStyle(element).color, 'red')
})

test('/postcss', async t => {
  const window = await nuxt.renderAndGetWindow(url('/css'))
  const element = window.document.querySelector('div.red')
  t.is(window.getComputedStyle(element)['background-color'], 'blue')
})

test('/stateful', async t => {
  const { html } = await nuxt.renderRoute('/stateful')
  t.true(html.includes('<div><p>The answer is 42</p></div>'))
})

test('/store', async t => {
  const { html } = await nuxt.renderRoute('/store')
  t.true(html.includes('<h1>Vuex Nested Modules</h1>'))
  t.true(html.includes('<p>1</p>'))
})

test('/head', async t => {
  const logSpy = await interceptLog(async () => {
    const window = await nuxt.renderAndGetWindow(url('/head'), { virtualConsole: false })
    t.is(window.document.title, 'My title - Nuxt.js')

    const html = window.document.body.innerHTML
    t.true(html.includes('<div><h1>I can haz meta tags</h1></div>'))
    t.true(html.includes('<script data-n-head="true" src="/body.js" data-body="true">'))

    const metas = window.document.getElementsByTagName('meta')
    t.is(metas[0].getAttribute('content'), 'my meta')
  })
  t.true(logSpy.calledOnce)
  t.is(logSpy.args[0][0], 'Body script!')
})

test('/async-data', async t => {
  const { html } = await nuxt.renderRoute('/async-data')
  t.true(html.includes('<p>Nuxt.js</p>'))
})

test('/await-async-data', async t => {
  const { html } = await nuxt.renderRoute('/await-async-data')
  t.true(html.includes('<p>Await Nuxt.js</p>'))
})

test('/callback-async-data', async t => {
  const { html } = await nuxt.renderRoute('/callback-async-data')
  t.true(html.includes('<p>Callback Nuxt.js</p>'))
})

test('/users/1', async t => {
  const { html } = await nuxt.renderRoute('/users/1')
  t.true(html.includes('<h1>User: 1</h1>'))
})

test('/validate should display a 404', async t => {
  const { html } = await nuxt.renderRoute('/validate')
  t.true(html.includes('This page could not be found'))
})

test('/validate?valid=true', async t => {
  const { html } = await nuxt.renderRoute('/validate?valid=true')
  t.true(html.includes('<h1>I am valid</h1>'))
})

test('/redirect', async t => {
  const { html, redirected } = await nuxt.renderRoute('/redirect')
  t.true(html.includes('<div id="__nuxt"></div>'))
  t.true(redirected.path === '/')
  t.true(redirected.status === 302)
})

test('/redirect -> check redirected source', async t => {
  const window = await nuxt.renderAndGetWindow(url('/redirect'))
  const html = window.document.body.innerHTML
  t.true(html.includes('<h1>Index page</h1>'))
})

test('/special-state -> check window.__NUXT__.test = true', async t => {
  const window = await nuxt.renderAndGetWindow(url('/special-state'))
  t.is(window.document.title, 'Nuxt.js')
  t.is(window.__NUXT__.test, true)
})

test('/error', async t => {
  const err = await t.throws(nuxt.renderRoute('/error', { req: {}, res: {} }))
  t.true(err.message.includes('Error mouahahah'))
})

test('/error status code', async t => {
  const errorSpy = await interceptError(async () => {
    const err = await t.throws(rp(url('/error')))
    t.true(err.statusCode === 500)
    t.true(err.response.body.includes('An error occurred in the application and your page could not be served'))
  })
  t.true(errorSpy.calledOnce)
  t.true(errorSpy.args[0][0].message.includes('Error mouahahah'))
})

test('/error2', async t => {
  const { html, error } = await nuxt.renderRoute('/error2')
  t.true(html.includes('Custom error'))
  t.true(error.message.includes('Custom error'))
  t.true(error.statusCode === undefined)
})

test('/error2 status code', async t => {
  try {
    await rp(url('/error2'))
  } catch (err) {
    t.is(err.statusCode, 500)
    t.true(err.response.body.includes('Custom error'))
  }
})

test('/error-midd', async t => {
  const errorSpy = await interceptError(async () => {
    const err = await t.throws(rp(url('/error-midd')))

    t.is(err.statusCode, 505)
    t.true(err.response.body.includes('Middleware Error'))
  })
  // Don't display error since redirect returns a noopApp
  t.true(errorSpy.notCalled)
})

test('/redirect2', async t => {
  const errorSpy = await interceptError(async () => {
    await rp(url('/redirect2')) // Should not console.error
  })
  // Don't display error since redirect returns a noopApp
  t.true(errorSpy.notCalled)
})

test('/no-ssr', async t => {
  const { html } = await nuxt.renderRoute('/no-ssr')
  t.true(html.includes('<div class="no-ssr-placeholder">&lt;p&gt;Loading...&lt;/p&gt;</div>'))
})

test('/no-ssr (client-side)', async t => {
  const window = await nuxt.renderAndGetWindow(url('/no-ssr'))
  const html = window.document.body.innerHTML
  t.true(html.includes('Displayed only on client-side</h1>'))
})

test('ETag Header', async t => {
  const errorSpy = await interceptError(async () => {
    const { headers: { etag } } = await rp(url('/stateless'), { resolveWithFullResponse: true })
    // Validate etag
    t.regex(etag, /W\/".*"$/)
    // Verify functionality
    const error = await t.throws(rp(url('/stateless'), { headers: { 'If-None-Match': etag } }))
    t.is(error.statusCode, 304)
  })
  t.true(errorSpy.calledOnce)
  t.true(errorSpy.args[0][0].includes('TypeError: Cannot read property \'split\' of undefined'))
})

test('/_nuxt/server-bundle.json should return 404', async t => {
  const err = await t.throws(rp(url('/_nuxt/server-bundle.json'), { resolveWithFullResponse: true }))
  t.is(err.statusCode, 404)
})

test('/_nuxt/ should return 404', async t => {
  const err = await t.throws(rp(url('/_nuxt/'), { resolveWithFullResponse: true }))
  t.is(err.statusCode, 404)
})

test('/meta', async t => {
  const { html } = await nuxt.renderRoute('/meta')

  t.true(html.includes('"meta":[{"works":true}]'))
})

test('/fn-midd', async t => {
  const err = await t.throws(rp(url('/fn-midd'), { resolveWithFullResponse: true }))
  t.is(err.statusCode, 403)
  t.true(err.response.body.includes('You need to ask the permission'))
})

test('/fn-midd?please=true', async t => {
  const { html } = await nuxt.renderRoute('/fn-midd?please=true')
  t.true(html.includes('<h1>Date:'))
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', async t => {
  await nuxt.close()
})
