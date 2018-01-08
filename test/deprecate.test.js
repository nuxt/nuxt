import test from 'ava'
import { resolve } from 'path'
import rp from 'request-promise-native'
import { Nuxt, Builder } from '..'
import { intercept, interceptWarn, release } from './helpers/console'

const port = 4010
const url = (route) => 'http://localhost:' + port + route

let nuxt = null
let builder = null
let buildSpies = null

// Init nuxt.js and create server listening on localhost:4000
test.serial('Init Nuxt.js', async t => {
  const rootDir = resolve(__dirname, 'fixtures/deprecate')
  let config = require(resolve(rootDir, 'nuxt.config.js'))
  config.rootDir = rootDir
  config.dev = false

  buildSpies = await intercept(async () => {
    nuxt = new Nuxt(config)
    builder = await new Builder(nuxt)
    await builder.build()
    await nuxt.listen(port, 'localhost')
  })

  t.true(buildSpies.log.calledWithMatch('DONE'))
  t.true(buildSpies.log.calledWithMatch('OPEN'))
})

test.serial('Deprecated: context.isServer and context.isClient', async t => {
  const warnSpy = await interceptWarn()
  await rp(url('/'))
  t.true(warnSpy.calledWith('context.isServer has been deprecated, please use process.server instead.'))
  t.true(warnSpy.calledWith('context.isClient has been deprecated, please use process.client instead.'))
  t.true(warnSpy.calledTwice)
  release()
})

test.serial('Deprecated: dev in build.extend()', async t => {
  t.true(buildSpies.warn.withArgs('dev has been deprecated in build.extend(), please use isDev').calledTwice)
})

test.serial('Deprecated: nuxt.plugin()', async t => {
  t.true(nuxt.__builder_plugin)
})

// Close server and ask nuxt to stop listening to file changes
test.after.always('Closing server and nuxt.js', async t => {
  await nuxt.close()
})
