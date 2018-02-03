import test from 'ava'
import { resolve } from 'path'
import { Nuxt, Builder } from '..'
import { interceptLog } from './helpers/console'

let nuxt = null
let builder = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  const rootDir = resolve(__dirname, 'fixtures/custom-dirs')
  let config = require(resolve(rootDir, 'nuxt.config.js'))
  config.rootDir = rootDir
  config.dev = false

  const logSpy = await interceptLog(async () => {
    nuxt = new Nuxt(config)
    builder = new Builder(nuxt)
    await builder.build()
    await nuxt.listen(4007, 'localhost')
  })

  t.true(logSpy.calledWithMatch('DONE'))
  t.true(logSpy.calledWithMatch('OPEN'))
})

test('/ (custom pages directory)', async t => {
  const { html } = await nuxt.renderRoute('/')
  t.true(html.includes('<h1>I have custom pages directory</h1>'))
})

test('/ (custom assets directory)', async t => {
  const { html } = await nuxt.renderRoute('/')
  t.true(html.includes('.global-css-selector'))
})

// Close server and ask nuxt to stop listening to file changes
test.after.always('Closing server and nuxt.js', async t => {
  await nuxt.close()
})
