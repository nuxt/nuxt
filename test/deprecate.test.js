import test from 'ava'
import stdMocks from 'std-mocks'
import { resolve } from 'path'
import rp from 'request-promise-native'
import { Nuxt, Builder } from '..'

const port = 4010
const url = (route) => 'http://localhost:' + port + route

let nuxt = null
let builder = null
let builtErr = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  const rootDir = resolve(__dirname, 'fixtures/deprecate')
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

test('Deprecated: context.isServer and context.isClient', async t => {
  stdMocks.use()
  await rp(url('/'))
  stdMocks.restore()
  const output = stdMocks.flush()
  t.true(output.stderr.length === 2)
})

test('Deprecated: dev in build.extend()', async t => {
  const deprecatedMsg = 'dev has been deprecated in build.extend(), please use isDev'
  const errors = builtErr.filter(value => value.indexOf(deprecatedMsg) === 0)
  t.true(errors.length === 2)
})

test('Deprecated: nuxt.plugin()', async t => {
  t.true(nuxt.__builder_plugin)
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  nuxt.close()
})
