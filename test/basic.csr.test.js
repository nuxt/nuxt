import test from 'ava'
import { resolve } from 'path'
import { Nuxt, Builder } from '../index'
import * as browser from './helpers/browser'

const port = 4003
const url = (route) => 'http://localhost:' + port + route

let nuxt = null
let page = null

// Init nuxt.js and create server listening on localhost:4003
test.before('Init Nuxt.js', async t => {
  const options = {
    rootDir: resolve(__dirname, 'fixtures/basic'),
    dev: false,
    head: {
      titleTemplate(titleChunk) {
        return titleChunk ? `${titleChunk} - Nuxt.js` : 'Nuxt.js'
      }
    }
  }
  nuxt = new Nuxt(options)
  await new Builder(nuxt).build()

  await nuxt.listen(port, 'localhost')
})

test.before('Start browser', async t => {
  await browser.start({
    // slowMo: 50,
    // headless: false
  })
})

test('Open /', async t => {
  page = await browser.page(url('/'))

  t.is(await page.$text('h1'), 'Index page')
})

test('/stateless', async t => {
  const { hook } = await page.nuxt.navigate('/stateless', false)
  const loading = await page.nuxt.loadingData()

  t.is(loading.show, true)
  await hook
  t.is(await page.$text('h1'), 'My component!')
})

test('/css', async t => {
  await page.nuxt.navigate('/css')

  t.is(await page.$text('.red'), 'This is red')
  t.is(await page.$eval('.red', (red) => window.getComputedStyle(red).color), 'rgb(255, 0, 0)')
})

test('/stateful', async t => {
  await page.nuxt.navigate('/stateful')

  t.is(await page.$text('p'), 'The answer is 42')
})

test('/store', async t => {
  await page.nuxt.navigate('/store')

  t.is(await page.$text('h1'), 'Vuex Nested Modules')
  t.is(await page.$text('p'), '1')
})

test('/head', async t => {
  const msg = new Promise((resolve) => page.on('console', (msg) => resolve(msg.text)))
  await page.nuxt.navigate('/head')
  const metas = await page.$$attr('meta', 'content')

  t.is(await msg, 'Body script!')
  t.is(await page.title(), 'My title - Nuxt.js')
  t.is(await page.$text('h1'), 'I can haz meta tags')
  t.is(metas[0], 'my meta')
})

test('/async-data', async t => {
  await page.nuxt.navigate('/async-data')

  t.is(await page.$text('p'), 'Nuxt.js')
})

test('/await-async-data', async t => {
  await page.nuxt.navigate('/await-async-data')

  t.is(await page.$text('p'), 'Await Nuxt.js')
})

test('/callback-async-data', async t => {
  await page.nuxt.navigate('/callback-async-data')

  t.is(await page.$text('p'), 'Callback Nuxt.js')
})

test('/users/1', async t => {
  await page.nuxt.navigate('/users/1')

  t.is(await page.$text('h1'), 'User: 1')
})

test('/validate should display a 404', async t => {
  await page.nuxt.navigate('/validate')
  const error = await page.nuxt.errorData()

  t.is(error.statusCode, 404)
  t.is(error.message, 'This page could not be found')
})

test('/validate?valid=true', async t => {
  await page.nuxt.navigate('/validate?valid=true')

  t.is(await page.$text('h1'), 'I am valid')
})

test('/redirect', async t => {
  await page.nuxt.navigate('/redirect')

  t.is(await page.$text('h1'), 'Index page')
})

test('/error', async t => {
  await page.nuxt.navigate('/error')

  t.deepEqual(await page.nuxt.errorData(), { statusCode: 500 })
  t.is(await page.$text('.title'), 'Error mouahahah')
})

test('/error2', async t => {
  await page.nuxt.navigate('/error2')

  t.is(await page.$text('.title'), 'Custom error')
  t.deepEqual(await page.nuxt.errorData(), { message: 'Custom error' })
})

test('/redirect2', async t => {
  await page.nuxt.navigate('/redirect2')

  t.is(await page.$text('h1'), 'Index page')
})

test('/redirect3', async t => {
  // New page for redirecting to external link.
  const page = await browser.page(url('/'))
  await page.nuxt.navigate('/redirect3', false)
  await page.waitForFunction(() => window.location.href === 'https://nuxtjs.org/')
  page.close()
  t.pass()
})

test('/no-ssr', async t => {
  await page.nuxt.navigate('/no-ssr')

  t.is(await page.$text('h1'), 'Displayed only on client-side')
})

test('/meta', async t => {
  await page.nuxt.navigate('/meta')

  const state = await page.nuxt.storeState()
  t.deepEqual(state.meta, [{ works: true }])
})

test('/fn-midd', async t => {
  await page.nuxt.navigate('/fn-midd')

  t.is(await page.$text('.title'), 'You need to ask the permission')
  t.deepEqual(await page.nuxt.errorData(), { message: 'You need to ask the permission', statusCode: 403 })
})

test('/fn-midd?please=true', async t => {
  await page.nuxt.navigate('/fn-midd?please=true')

  const h1 = await page.$text('h1')
  t.true(h1.includes('Date:'))
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  nuxt.close()
})

test.after('Stop browser', async t => {
  await browser.stop()
})
