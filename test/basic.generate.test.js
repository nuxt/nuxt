import test from 'ava'
import { resolve } from 'path'
import http from 'http'
import serveStatic from 'serve-static'
import rp from 'request-promise-native'
const port = 4003
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
  await nuxt.generate()
  const serve = serveStatic(resolve(__dirname, 'fixtures/basic/dist'))
  server = http.createServer(serve)
  server.listen(port)
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
  t.true(html.includes('<h1>I am valid</h1>'))
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

test('/error', async t => {
  const window = await nuxt.renderAndGetWindow(url('/error'))
  const html = window.document.body.innerHTML
  t.true(html.includes('Error mouahahah'))
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server', t => {
  server.close()
})
