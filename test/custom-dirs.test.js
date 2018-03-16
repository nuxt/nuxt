import test from 'ava'
import rp from 'request-promise-native'
import { Nuxt, Builder } from '..'
import { interceptLog } from './helpers/console'
import { loadConfig } from './helpers/config'

const port = 4007
const url = route => 'http://localhost:' + port + route

let nuxt = null
let builder = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  const config = loadConfig('/custom-dirs', { dev: false })

  const logSpy = await interceptLog(async () => {
    nuxt = new Nuxt(config)
    builder = new Builder(nuxt)
    await builder.build()
    await nuxt.listen(4007, 'localhost')
  })

  t.true(logSpy.calledWithMatch('DONE'))
  t.true(logSpy.calledWithMatch('OPEN'))
})

test('custom assets directory', async t => {
  const { html } = await nuxt.renderRoute('/')
  t.true(html.includes('.global-css-selector'))
})

test('custom layouts directory', async t => {
  const { html } = await nuxt.renderRoute('/')
  t.true(html.includes('<p>I have custom layouts directory</p>'))
})

test('custom middleware directory', async t => {
  const window = await nuxt.renderAndGetWindow(url('/user-agent'))
  const html = window.document.body.innerHTML
  t.true(html.includes('<pre>Mozilla'))
})

test('custom pages directory', async t => {
  const { html } = await nuxt.renderRoute('/')
  t.true(html.includes('<h1>I have custom pages directory</h1>'))
})

test('custom static directory', async t => {
  const { headers } = await rp(url('/test.txt'), {
    resolveWithFullResponse: true
  })
  t.is(headers['cache-control'], 'public, max-age=0')
})

// Close server and ask nuxt to stop listening to file changes
test.after.always('Closing server and nuxt.js', async t => {
  await nuxt.close()
})
