import test from 'ava'
import { resolve } from 'path'
import { Nuxt, Builder } from '..'
import { intercept } from './helpers/console'

const port = 4010

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

test.serial('Deprecated: nuxt.plugin()', async t => {
  t.true(nuxt.__builder_plugin)
})

test.serial('Deprecated: module.addVendor()', async t => {
  t.true(buildSpies.warn.calledWithMatch('module: addVendor is no longer necessary'))
})

test.serial('Deprecated: module callback', async t => {
  t.true(
    buildSpies.warn.calledWithMatch(
      'Supporting callbacks is deprecated and will be removed in next releases. Consider using async/await.'
    )
  )
})

test.serial('Error: nuxt.plugin()', async t => {
  const error = t.throws(() => nuxt.plugin('build:done', () => {}))
  t.is(error.message, 'nuxt.plugin(\'build:done\',..) is not supported. Use new hooks system.')
})

// Close server and ask nuxt to stop listening to file changes
test.after.always('Closing server and nuxt.js', async t => {
  await nuxt.close()
})
