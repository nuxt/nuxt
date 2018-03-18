import { resolve } from 'path'

import { Nuxt, Builder } from '..'

import * as browser from './helpers/browser'

const port = 4003
const url = route => 'http://localhost:' + port + route

let nuxt = null
let page = null

const waitFor = ms => new Promise(resolve => setTimeout(resolve, ms || 0))

describe('basic csr', () => {
  // Init nuxt.js and create server listening on localhost:4003
  beforeAll(async () => {
    const options = {
      rootDir: resolve(__dirname, 'fixtures/basic'),
      buildDir: '.nuxt-csr',
      dev: true,
      build: {
        stats: false
      }
    }

    nuxt = new Nuxt(options)
    new Builder(nuxt).build()
    await nuxt.listen(port, 'localhost')
  }, 30000)

  test('Start browser', async () => {
    expect.assertions(0) // suppress 'no assertions' warning
    await browser.start({
      // slowMo: 50,
      // headless: false
    })
  })

  test('Open /', async () => {
    page = await browser.page(url('/'))
    await waitFor(1000)

    expect(await page.$text('h1')).toBe('Index page')
  })

  test('/stateless', async () => {
    const { hook } = await page.nuxt.navigate('/stateless', false)
    const loading = await page.nuxt.loadingData()
    await waitFor(1000)

    expect(loading.show).toBe(true)
    await hook
    expect(await page.$text('h1')).toBe('My component!')
  })

  test('/css', async () => {
    await page.nuxt.navigate('/css')
    await waitFor(1000)

    expect(await page.$text('.red')).toBe('This is red')
    expect(await page.$eval('.red', red => window.getComputedStyle(red).color)).toBe('rgb(255, 0, 0)')
  })

  test('/stateful', async () => {
    await page.nuxt.navigate('/stateful')
    await waitFor(1000)

    expect(await page.$text('p')).toBe('The answer is 42')
  })

  test('/store', async () => {
    await page.nuxt.navigate('/store')
    await waitFor(1000)

    expect(await page.$text('h1')).toBe('Vuex Nested Modules')
    expect(await page.$text('p')).toBe('1')
  })

  test('/head', async () => {
    const msg = new Promise(resolve =>
      page.on('console', msg => resolve(msg.text()))
    )
    await page.nuxt.navigate('/head')
    const metas = await page.$$attr('meta', 'content')
    await waitFor(1000)

    expect(await msg).toBe('Body script!')
    expect(await page.title()).toBe('My title - Nuxt.js')
    expect(await page.$text('h1')).toBe('I can haz meta tags')
    expect(metas[0]).toBe('my meta')
  })

  test('/async-data', async () => {
    await page.nuxt.navigate('/async-data')
    await waitFor(1000)

    expect(await page.$text('p')).toBe('Nuxt.js')
  })

  test('/await-async-data', async () => {
    await page.nuxt.navigate('/await-async-data')
    await waitFor(1000)

    expect(await page.$text('p')).toBe('Await Nuxt.js')
  })

  test('/callback-async-data', async () => {
    await page.nuxt.navigate('/callback-async-data')
    await waitFor(1000)

    expect(await page.$text('p')).toBe('Callback Nuxt.js')
  })

  test('/users/1', async () => {
    await page.nuxt.navigate('/users/1')
    await waitFor(1000)

    expect(await page.$text('h1')).toBe('User: 1')
  })

  test('/validate should display a 404', async () => {
    await page.nuxt.navigate('/validate')
    await waitFor(1000)

    const error = await page.nuxt.errorData()

    expect(error.statusCode).toBe(404)
    expect(error.message).toBe('This page could not be found')
  })

  test('/validate?valid=true', async () => {
    await page.nuxt.navigate('/validate?valid=true')
    await waitFor(1000)

    expect(await page.$text('h1')).toBe('I am valid')
  })

  test('/redirect', async () => {
    await page.nuxt.navigate('/redirect')
    await waitFor(1000)

    expect(await page.$text('h1')).toBe('Index page')
  })

  test('/error', async () => {
    await page.nuxt.navigate('/error')
    await waitFor(1000)

    expect(await page.nuxt.errorData()).toEqual({ statusCode: 500 })
    expect(await page.$text('.title')).toBe('Error mouahahah')
  })

  test('/error2', async () => {
    await page.nuxt.navigate('/error2')
    await waitFor(1000)

    expect(await page.$text('.title')).toBe('Custom error')
    expect(await page.nuxt.errorData()).toEqual({ message: 'Custom error' })
  })

  test('/redirect-middleware', async () => {
    await page.nuxt.navigate('/redirect-middleware')
    await waitFor(1000)

    expect(await page.$text('h1')).toBe('Index page')
  })

  test('/redirect-external', async () => {
    // New page for redirecting to external link.
    const page = await browser.page(url('/'))

    await page.nuxt.navigate('/redirect-external', false)
    await waitFor(1000)

    await page.waitForFunction(
      () => window.location.href === 'https://nuxtjs.org/'
    )
    page.close()
  })

  test('/redirect-name', async () => {
    await page.nuxt.navigate('/redirect-name')
    await waitFor(1000)

    expect(await page.$text('h1')).toBe('My component!')
  })

  test('/no-ssr', async () => {
    await page.nuxt.navigate('/no-ssr')
    await waitFor(1000)

    expect(await page.$text('h1')).toBe('Displayed only on client-side')
  })

  test('/meta', async () => {
    await page.nuxt.navigate('/meta')
    await waitFor(1000)

    const state = await page.nuxt.storeState()
    expect(state.meta).toEqual([{ works: true }])
  })

  test('/fn-midd', async () => {
    await page.nuxt.navigate('/fn-midd')
    await waitFor(1000)

    expect(await page.$text('.title')).toBe('You need to ask the permission')
    expect(await page.nuxt.errorData()).toEqual({
      message: 'You need to ask the permission',
      statusCode: 403
    })
  })

  test('/fn-midd?please=true', async () => {
    await page.nuxt.navigate('/fn-midd?please=true')
    await waitFor(1000)

    const h1 = await page.$text('h1')
    expect(h1.includes('Date:')).toBe(true)
  })

  test('/router-guard', async () => {
    await page.nuxt.navigate('/router-guard')
    await waitFor(1000)

    const p = await page.$text('p')
    expect(p).toBe('Nuxt.js')
  })

  test('Stop browser', async () => {
    process.on('unhandledRejection', () => { })
    await browser.stop()
  })

  // Close server and ask nuxt to stop listening to file changes
  test('Closing server and nuxt.js', async () => {
    await nuxt.close()
  })
})
