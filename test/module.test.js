import test from 'ava'
import stdMocks from 'std-mocks'
import { resolve, normalize } from 'path'
import rp from 'request-promise-native'
import { Nuxt, Builder } from '../index.js'

const port = 4006
const url = (route) => 'http://localhost:' + port + route

let nuxt = null
let builder = null
let builtErr = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  const rootDir = resolve(__dirname, 'fixtures/module')
  let config = require(resolve(rootDir, 'nuxt.config.js'))
  config.rootDir = rootDir
  config.dev = false
  nuxt = new Nuxt(config)
  builder = new Builder(nuxt)

  stdMocks.use({
    stdout: false,
    stderr: true
  })
  await builder.build()
  stdMocks.restore()
  builtErr = stdMocks.flush().stderr

  await nuxt.listen(port, 'localhost')
})

test('Vendor', async t => {
  t.true(nuxt.options.build.vendor.indexOf('lodash') !== -1, 'lodash added to config')
})

test('Plugin', async t => {
  t.true(normalize(nuxt.options.plugins[0].src)
    .includes(normalize('fixtures/module/.nuxt/basic.reverse.')), 'plugin added to config')
  const { html } = await nuxt.renderRoute('/')
  t.true(html.includes('<h1>TXUN</h1>'), 'plugin works')
})

test('Middleware', async t => {
  let response = await rp(url('/api'))
  t.is(response, 'It works!', '/api response is correct')
})

test('Hooks', async t => {
  t.is(nuxt.__module_hook, 1)
  t.is(nuxt.__renderer_hook, 2)
  t.is(nuxt.__builder_hook, 3)
})

test('Hooks - Functional', async t => {
  t.true(nuxt.__ready_called__)
  t.true(builder.__build_done__)
})

test('Hooks - Error', async t => {
  const errors = builtErr.filter(value => value.indexOf('build:extendRoutes') >= 0)
  t.true(errors.length === 1)
})

// Note: Plugin is deprecated. Please use new hooks system.
test('Plugin', async t => {
  t.is(nuxt.__builder_plugin, 4)
  const error = builtErr.filter(value => value.indexOf('deprecated') >= 0)
  t.true(error.length === 1)
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  nuxt.close()
})
