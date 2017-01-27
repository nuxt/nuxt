import test from 'ava'
import { resolve } from 'path'
import rp from 'request-promise-native'
const port = 4000
const url = (route) => 'http://localhost:' + port + route

let nuxt = null
let server = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  const Nuxt = require('../')
  const options = {
    rootDir: resolve(__dirname, 'fixtures/basic'),
    dev: false
  }
  nuxt = new Nuxt(options)
  await nuxt.build()
  server = new nuxt.Server(nuxt)
  server.listen(port, 'localhost')
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

test('/stateful', async t => {
  const { html } = await nuxt.renderRoute('/stateful')
  t.true(html.includes('<div><p>The answer is 42</p></div>'))
})

test('/head', async t => {
  const window = await nuxt.renderAndGetWindow(url('/head'), { virtualConsole: true })
  const html = window.document.body.innerHTML
  const metas = window.document.getElementsByTagName('meta')
  t.is(window.document.title, 'My title')
  t.is(metas[0].getAttribute('content'), 'my meta')
  t.true(html.includes('<div><h1>I can haz meta tags</h1></div>'))
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

test('/error', async t => {
  const { html, error } = await nuxt.renderRoute('/error')
  t.true(html.includes('Error mouahahah'))
  t.true(error.message.includes('Error mouahahah'))
  t.true(error.statusCode === 500)
})

test('/error status code', async t => {
  try {
    await rp(url('/error'))
  } catch (err) {
    t.true(err.statusCode === 500)
    t.true(err.response.body.includes('Error mouahahah'))
  }
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
    t.true(err.statusCode === 500)
    t.true(err.response.body.includes('Custom error'))
  }
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  server.close()
  nuxt.close()
})
