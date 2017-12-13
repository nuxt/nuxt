import test from 'ava'
import { interceptWarn, release } from './helpers/console'
import { resolve } from 'path'
import rp from 'request-promise-native'
import { Nuxt, Builder } from '..'

const port = 4010
const url = (route) => 'http://localhost:' + port + route

let nuxt = null
let builder = null
let buildLog = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  const rootDir = resolve(__dirname, 'fixtures/deprecate')
  let config = require(resolve(rootDir, 'nuxt.config.js'))
  config.rootDir = rootDir
  config.dev = false
  nuxt = new Nuxt(config)
  builder = new Builder(nuxt)

  buildLog = await interceptWarn()
  await builder.build()
  release()

  await nuxt.listen(port, 'localhost')
})

test('Deprecated: context.isServer and context.isClient', async t => {
  const logSpy = await interceptWarn()
  await rp(url('/'))
  t.true(logSpy.calledWith('context.isServer has been deprecated, please use process.server instead.'))
  t.true(logSpy.calledWith('context.isClient has been deprecated, please use process.client instead.'))
  t.true(logSpy.calledTwice)
  release()
})

test('Deprecated: dev in build.extend()', async t => {
  t.true(buildLog.withArgs('dev has been deprecated in build.extend(), please use isDev').calledTwice)
})

test('Deprecated: nuxt.plugin()', async t => {
  t.true(nuxt.__builder_plugin)
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  nuxt.close()
})
