import test from 'ava'
import { resolve } from 'path'
import http from 'http'
import serveStatic from 'serve-static'
import finalhandler from 'finalhandler'
import rp from 'request-promise-native'
import { Nuxt, Builder, Generator } from '../index.js'

const port = 4002
const url = (route) => 'http://localhost:' + port + route

let nuxt = null
let server = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  const rootDir = resolve(__dirname, 'fixtures/basic')
  let config = require(resolve(rootDir, 'nuxt.config.js'))
  config.rootDir = rootDir
  config.dev = false
  nuxt = new Nuxt(config)
  const builder = new Builder(nuxt)
  const generator = new Generator(nuxt, builder)
  try {
    await generator.generate() // throw an error (of /validate route)
  } catch (err) {
  }
  const serve = serveStatic(resolve(__dirname, 'fixtures/basic/dist'))
  server = http.createServer((req, res) => {
    serve(req, res, finalhandler(req, res))
  })
  server.listen(port)
})

test('Check ready hook called', async t => {
  t.true(nuxt.__hook_called__)
})

test('/stateless', async t => {
  const window = await nuxt.renderAndGetWindow(url('/stateless'))
  const html = window.document.body.innerHTML
  t.true(html.includes('<h1>My component!</h1>'))
})

test('/css', async t => {
  const window = await nuxt.renderAndGetWindow(url('/css'))
  const element = window.document.querySelector('.red')
  t.not(element, null)
  t.is(element.textContent, 'This is red')
  t.is(element.className, 'red')
  t.is(window.getComputedStyle(element).color, 'red')
})

test('/stateful', async t => {
  const window = await nuxt.renderAndGetWindow(url('/stateful'))
  const html = window.document.body.innerHTML
  t.true(html.includes('<div><p>The answer is 42</p></div>'))
})

test('/head', async t => {
  const window = await nuxt.renderAndGetWindow(url('/head'))
  const html = window.document.body.innerHTML
  const metas = window.document.getElementsByTagName('meta')
  t.is(window.document.title, 'My title')
  t.is(metas[0].getAttribute('content'), 'my meta')
  t.true(html.includes('<div><h1>I can haz meta tags</h1></div>'))
})

test('/async-data', async t => {
  const window = await nuxt.renderAndGetWindow(url('/async-data'))
  const html = window.document.body.innerHTML
  t.true(html.includes('<p>Nuxt.js</p>'))
})

test('/users/1', async t => {
  const html = await rp(url('/users/1'))
  t.true(html.includes('<h1>User: 1</h1>'))
})

test('/users/2', async t => {
  const html = await rp(url('/users/2'))
  t.true(html.includes('<h1>User: 2</h1>'))
})

test('/users/3 (payload given)', async t => {
  const html = await rp(url('/users/3'))
  t.true(html.includes('<h1>User: 3000</h1>'))
})

test('/users/4 -> Not found', async t => {
  try {
    await rp(url('/users/4'))
  } catch (error) {
    t.true(error.statusCode === 404)
    t.true(error.response.body.includes('Cannot GET /users/4'))
  }
})

test('/validate should not be server-rendered', async t => {
  const html = await rp(url('/validate'))
  t.true(html.includes('<div id="__nuxt"></div>'))
  t.true(html.includes('serverRendered:!1'))
})

test('/validate -> should display a 404', async t => {
  const window = await nuxt.renderAndGetWindow(url('/validate'))
  const html = window.document.body.innerHTML
  t.true(html.includes('This page could not be found'))
})

test('/validate?valid=true', async t => {
  const window = await nuxt.renderAndGetWindow(url('/validate?valid=true'))
  const html = window.document.body.innerHTML
  t.true(html.includes('I am valid</h1>'))
})

test('/redirect should not be server-rendered', async t => {
  const html = await rp(url('/redirect'))
  t.true(html.includes('<div id="__nuxt"></div>'))
  t.true(html.includes('serverRendered:!1'))
})

test('/redirect -> check redirected source', async t => {
  const window = await nuxt.renderAndGetWindow(url('/redirect'))
  const html = window.document.body.innerHTML
  t.true(html.includes('<h1>Index page</h1>'))
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server', t => {
  server.close()
})
