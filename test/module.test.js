import test from 'ava'
import { resolve } from 'path'
import rp from 'request-promise-native'

const port = 4006
const url = (route) => 'http://localhost:' + port + route

let nuxt = null
let server = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  const Nuxt = require('../')
  const rootDir = resolve(__dirname, 'fixtures/module')
  let config = require(resolve(rootDir, 'nuxt.config.js'))
  config.rootDir = rootDir
  config.dev = false
  nuxt = await new Nuxt(config)
  await nuxt.build()
  server = new nuxt.Server(nuxt)
  server.listen(port, 'localhost')
})

test('Vendor', async t => {
  t.true(nuxt.options.build.vendor.indexOf('lodash') !== -1, 'lodash added to config')
})

test('Plugin', async t => {
  t.true(nuxt.options.plugins[0].src.includes('~/.nuxt/basic.reverse.'), 'plugin added to config')
  const { html } = await nuxt.renderRoute('/')
  t.true(html.includes('<h1>TXUN</h1>'), 'plugin works')
})

test('Middleware', async t => {
  let response = await rp(url('/api'))
  t.is(response, 'It works!', '/api response is correct')
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  server.close()
  nuxt.close()
})
