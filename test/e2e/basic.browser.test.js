import Browser from '../utils/browser'
import { loadFixture, getPort, Nuxt } from '../utils'

let port
const browser = new Browser()
const url = route => 'http://localhost:' + port + route

let nuxt = null
let page = null

describe('basic browser', () => {
  beforeAll(async () => {
    const config = await loadFixture('basic')
    nuxt = new Nuxt(config)
    port = await getPort()
    await nuxt.listen(port, 'localhost')

    await browser.start({
      // slowMo: 50,
      // headless: false
    })
  })

  test('Open /', async () => {
    page = await browser.page(url('/'))

    expect(await page.$text('h1')).toBe('Index page')
  })

  test('/noloading', async () => {
    const { hook } = await page.nuxt.navigate('/noloading')
    const loading = await page.nuxt.loadingData()
    expect(loading.show).toBe(true)
    await hook
    expect(loading.show).toBe(true)
    await page.waitForFunction(
      `$nuxt.$loading.$data.show === false`
    )
    await page.waitForFunction(
      `document.querySelector('p').innerText === 'true'`
    )
  })

  test('/stateless', async () => {
    const { hook } = await page.nuxt.navigate('/stateless', false)
    const loading = await page.nuxt.loadingData()

    expect(loading.show).toBe(true)
    await hook
    expect(await page.$text('h1')).toBe('My component!')
  })

  test('/css', async () => {
    await page.nuxt.navigate('/css')

    expect(await page.$text('.red')).toBe('This is red')
    expect(await page.$eval('.red', (red) => {
      const { color, backgroundColor } = window.getComputedStyle(red)
      return { color, backgroundColor }
    })).toEqual({
      color: 'rgb(255, 0, 0)',
      backgroundColor: 'rgb(0, 0, 255)'
    })
  })

  test.skip('/stateful', async () => {
    const { hook } = await page.nuxt.navigate('/stateful')

    await hook
    expect(await page.$text('p')).toBe('The answer is 42')
  })

  test('/store', async () => {
    await page.nuxt.navigate('/store')

    expect(await page.$text('h1')).toBe('Vuex Nested Modules')
    expect(await page.$text('p')).toBe('1')
  })

  test('/head', async () => {
    const msg = new Promise(resolve =>
      page.on('console', msg => resolve(msg.text()))
    )
    await page.nuxt.navigate('/head')
    const metas = await page.$$attr('meta', 'content')

    expect(await msg).toBe('Body script!')
    expect(await page.title()).toBe('My title - Nuxt.js')
    expect(await page.$text('h1')).toBe('I can haz meta tags')
    expect(metas[0]).toBe('my meta')
  })

  test('/async-data', async () => {
    await page.nuxt.navigate('/async-data')

    expect(await page.$text('p')).toBe('Nuxt.js')
  })

  test('/await-async-data', async () => {
    await page.nuxt.navigate('/await-async-data')

    expect(await page.$text('p')).toBe('Await Nuxt.js')
  })

  test('/callback-async-data', async () => {
    await page.nuxt.navigate('/callback-async-data')

    expect(await page.$text('p')).toBe('Callback Nuxt.js')
  })

  test('/users/1', async () => {
    await page.nuxt.navigate('/users/1')

    expect(await page.$text('h1')).toBe('User: 1')
  })

  test('/validate should display a 404', async () => {
    await page.nuxt.navigate('/validate')

    const error = await page.nuxt.errorData()

    expect(error.statusCode).toBe(404)
    expect(error.message).toBe('This page could not be found')
  })

  test('/validate?valid=true', async () => {
    await page.nuxt.navigate('/validate?valid=true')

    expect(await page.$text('h1')).toBe('I am valid')
  })

  test('/redirect', async () => {
    await page.nuxt.navigate('/redirect')

    expect(await page.$text('h1')).toBe('Index page')
  })

  test('/error', async () => {
    await page.nuxt.navigate('/error')

    expect(await page.nuxt.errorData()).toEqual({ statusCode: 500 })
    expect(await page.$text('.title')).toBe('Error mouahahah')
  })

  test('/error2', async () => {
    await page.nuxt.navigate('/error2')

    expect(await page.$text('.title')).toBe('Custom error')
    expect(await page.nuxt.errorData()).toEqual({ message: 'Custom error' })
  })

  test('/redirect-middleware', async () => {
    await page.nuxt.navigate('/redirect-middleware')

    expect(await page.$text('h1')).toBe('Index page')
  })

  test('/redirect-external', async () => {
    // New page for redirecting to external link.
    const page = await browser.page(url('/'))

    await page.nuxt.navigate('/redirect-external', false)

    await page.waitForFunction(
      () => window.location.href === 'https://nuxtjs.org/'
    )
    page.close()
  })

  test('/redirect-name', async () => {
    await page.nuxt.navigate('/redirect-name')

    expect(await page.$text('h1')).toBe('My component!')
  })

  test('/no-ssr', async () => {
    await page.nuxt.navigate('/no-ssr')

    expect(await page.$text('h1')).toBe('Displayed only on client-side')
  })

  test('/pug', async () => {
    await page.nuxt.navigate('/pug')

    expect(await page.$text('h1')).toBe('Pug page')
  })

  test('/meta', async () => {
    await page.nuxt.navigate('/meta')

    const state = await page.nuxt.storeState()
    expect(state.meta).toEqual([{ works: true }])
  })

  test('/fn-midd', async () => {
    await page.nuxt.navigate('/fn-midd')

    expect(await page.$text('.title')).toBe('You need to ask the permission')
    expect(await page.nuxt.errorData()).toEqual({
      message: 'You need to ask the permission',
      statusCode: 403
    })
  })

  test('/fn-midd?please=true', async () => {
    await page.nuxt.navigate('/fn-midd?please=true')

    const h1 = await page.$text('h1')
    expect(h1.includes('Date:')).toBe(true)
  })

  test('/router-guard', async () => {
    await page.nuxt.navigate('/router-guard')

    const p = await page.$text('p')
    expect(p).toBe('Nuxt.js')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })

  // Stop browser
  afterAll(async () => {
    await page.close()
    await browser.close()
  })
})
