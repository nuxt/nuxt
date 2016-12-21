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
  t.true(html.includes('<h1>I have custom configurations</h1>'))
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  server.close()
  nuxt.close()
})
