import test from 'ava'
import { resolve } from 'path'
import { Nuxt, Builder } from '../index.js'

const port = 4005
const url = (route) => 'http://localhost:' + port + route

let nuxt = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  const options = {
    rootDir: resolve(__dirname, 'fixtures/error'),
    dev: false
  }
  nuxt = new Nuxt(options)
  await new Builder(nuxt).build()

  await nuxt.listen(port, 'localhost')
})

test('/ should display an error', async t => {
  try {
    await nuxt.renderRoute('/')
  } catch (e) {
    t.true(e.message.includes('not_defined is not defined'))
  }
})

test('/404 should display an error too', async t => {
  let { error } = await nuxt.renderRoute('/404')
  t.true(error.message.includes('This page could not be found'))
})

test('/ with renderAndGetWindow()', async t => {
  const err = await t.throws(nuxt.renderAndGetWindow(url('/')))
  t.is(err.response.statusCode, 500)
  t.is(err.response.statusMessage, 'NuxtServerError')
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  nuxt.close()
})
