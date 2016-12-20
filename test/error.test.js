import test from 'ava'
import { resolve } from 'path'
const port = 4002
const url = (route) => 'http://localhost:' + port + route

let nuxt = null
let server = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', t => {
  const Nuxt = require('../')
  const options = {
    rootDir: resolve(__dirname, 'error'),
    dev: false
  }
  nuxt = new Nuxt(options)
  return nuxt.build()
  .then(function () {
    server = new nuxt.Server(nuxt)
    server.listen(port, 'localhost')
  })
})

test('/ should display an error', async t => {
  try {
    await nuxt.renderRoute('/')
  } catch (e) {
    t.true(e.message.includes('not_defined is not defined'))
  }
})

test('/404 should display an error too', async t => {
  try {
    await nuxt.renderRoute('/404')
  } catch (e) {
    t.true(e.message.includes('not_defined is not defined'))
  }
})

test('/ with renderAndGetWindow()', async t => {
  try {
    await nuxt.renderAndGetWindow(url('/'))
  } catch (e) {
    t.true(e.message.includes('Could not load the nuxt app'))
    t.true(e.body.includes('not_defined is not defined'))
  }
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  server.close()
  nuxt.close()
})
