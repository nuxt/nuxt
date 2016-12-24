import test from 'ava'
import { resolve } from 'path'
const port = 4004
const url = (route) => 'http://localhost:' + port + route

let nuxt = null
let server = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  const Nuxt = require('../')
  const rootDir = resolve(__dirname, 'fixtures/with-config')
  let config = require(resolve(rootDir, 'nuxt.config.js'))
  config.rootDir = rootDir
  config.dev = false
  nuxt = new Nuxt(config)
  await nuxt.build()
  server = new nuxt.Server(nuxt)
  server.listen(port, 'localhost')
})

test('/', async t => {
  const { html } = await nuxt.renderRoute('/')
  t.true(html.includes('<h1>I have custom configurations</h1>'))
})

test('/test/ (router base)', async t => {
  const window = await nuxt.renderAndGetWindow(url('/test/'))
  const html = window.document.body.innerHTML
  t.true(html.includes('<h1>Default layout</h1>'))
  t.true(html.includes('<h1>I have custom configurations</h1>'))
})

test('/test/about (custom layout)', async t => {
  const window = await nuxt.renderAndGetWindow(url('/test/about'))
  const html = window.document.body.innerHTML
  t.true(html.includes('<h1>Custom layout</h1>'))
  t.true(html.includes('<h1>About page</h1>'))
})

test('/test/env', async t => {
  const window = await nuxt.renderAndGetWindow(url('/test/env'))
  const html = window.document.body.innerHTML
  t.true(html.includes('"bool": true'))
  t.true(html.includes('"num": 23'))
  t.true(html.includes('"string": "Nuxt.js"'))
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  server.close()
  nuxt.close()
})

test.after('Should be able to start Nuxt with build done', t => {
  const Nuxt = require('../')
  const rootDir = resolve(__dirname, 'fixtures/with-config')
  let config = require(resolve(rootDir, 'nuxt.config.js'))
  config.rootDir = rootDir
  config.dev = false
  nuxt = new Nuxt(config)
})
