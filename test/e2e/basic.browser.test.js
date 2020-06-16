import Browser from '../utils/browser'
import { loadFixture, getPort, Nuxt, waitFor } from '../utils'

let port
const browser = new Browser()
const url = route => 'http://localhost:' + port + route

let nuxt = null
let page = null

describe('basic browser', () => {
  beforeAll(async () => {
    const config = await loadFixture('basic')
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')

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
    const { hook } = await page.nuxt.navigate('/noloading', false)
    await waitFor(nuxt.options.loading.throttle + 100)
    let loading = await page.nuxt.loadingData()
    expect(loading.show).toBe(true)
    await hook
    loading = await page.nuxt.loadingData()
    expect(loading.show).toBe(true)
    await page.waitForFunction(
      '$nuxt.$loading.$data.show === false'
    )
    await page.waitForFunction(
      'document.querySelector(\'p\').innerText === \'true\''
    )
  })

  test('/stateless', async () => {
    const { hook } = await page.nuxt.navigate('/stateless', false)

    await hook
    expect(await page.$text('h1')).toBe('My component!')
  })

  test('/store-module', async () => {
    await page.nuxt.navigate('/store-module')
    expect(await page.$text('h1')).toBe('mutated')
  })

  test('/css', async () => {
    await page.nuxt.navigate('/css')

    expect(await page.$text('.red', true)).toEqual('This is red')
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

    expect(await page.$text('h1')).toBe('foo/bar/baz: Vuex Nested Modules')
    expect(await page.$text('h2')).toBe('index/counter: 1')
    expect(await page.$text('h3')).toBe('foo/blarg/getVal: 4')
    expect(await page.$text('h4')).toBe('foo/bab/getBabVal: 10')
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
    expect(metas[1]).toBe('my meta')
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

  test('/scroll-to-top with scrollToTop set to true', async () => {
    const page = await browser.page(url('/scroll-to-top'))
    await page.evaluate(() => window.scrollBy(0, window.innerHeight))
    await page.nuxt.navigate('/scroll-to-top/scroll-to-top-true')
    const pageYOffset = await page.evaluate(() => window.pageYOffset)
    expect(pageYOffset).toBe(0)
    page.close()
  })

  test('/scroll-to-top with scrollToTop set to false', async () => {
    const page = await browser.page(url('/scroll-to-top'))
    await page.evaluate(() => window.scrollBy(0, window.innerHeight))
    await page.nuxt.navigate('/scroll-to-top/scroll-to-top-false')
    const pageYOffset = await page.evaluate(() => window.pageYOffset)
    expect(pageYOffset).toBeGreaterThan(0)
    page.close()
  })

  test('/scroll-to-top in the same page', async () => {
    const page = await browser.page(url('/scroll-to-top'))
    await page.evaluate(() => window.scrollBy(0, window.innerHeight))
    await page.nuxt.navigate('/scroll-to-top?test=1')
    const pageYOffset = await page.evaluate(() => window.pageYOffset)
    expect(pageYOffset).toBeGreaterThan(0)
    page.close()
  })

  test('/scroll-to-top in the same page with watchQuery: true', async () => {
    const page = await browser.page(url('/scroll-to-top/watch-query-true'))
    await page.evaluate(() => window.scrollBy(0, window.innerHeight))
    await page.nuxt.navigate('/scroll-to-top/watch-query-true?test=1')
    let pageYOffset = await page.evaluate(() => window.pageYOffset)
    expect(pageYOffset).toBe(0)
    await page.nuxt.go(-1)
    pageYOffset = await page.evaluate(() => window.pageYOffset)
    expect(pageYOffset).toBeGreaterThan(0)
    page.close()
  })

  test('/scroll-to-top in the same page with watchQuery array', async () => {
    const page = await browser.page(url('/scroll-to-top/watch-query-array'))
    await page.evaluate(() => window.scrollBy(0, window.innerHeight))
    await page.nuxt.navigate('/scroll-to-top/watch-query-array?other=1')
    let pageYOffset = await page.evaluate(() => window.pageYOffset)
    expect(pageYOffset).toBeGreaterThan(0)
    await page.nuxt.go(-1)
    pageYOffset = await page.evaluate(() => window.pageYOffset)
    expect(pageYOffset).toBeGreaterThan(0)
    await page.nuxt.navigate('/scroll-to-top/watch-query-array?test=1')
    pageYOffset = await page.evaluate(() => window.pageYOffset)
    expect(pageYOffset).toBe(0)
    await page.nuxt.go(-1)
    pageYOffset = await page.evaluate(() => window.pageYOffset)
    expect(pageYOffset).toBeGreaterThan(0)
    page.close()
  })

  test('/scroll-to-top in the same page with watchQuery function', async () => {
    const page = await browser.page(url('/scroll-to-top/watch-query-fn'))
    await page.evaluate(() => window.scrollBy(0, window.innerHeight))
    await page.nuxt.navigate('/scroll-to-top/watch-query-fn?other=1')
    let pageYOffset = await page.evaluate(() => window.pageYOffset)
    expect(pageYOffset).toBeGreaterThan(0)
    await page.nuxt.go(-1)
    pageYOffset = await page.evaluate(() => window.pageYOffset)
    expect(pageYOffset).toBeGreaterThan(0)
    await page.nuxt.navigate('/scroll-to-top/watch-query-fn?test=1')
    pageYOffset = await page.evaluate(() => window.pageYOffset)
    expect(pageYOffset).toBe(0)
    await page.nuxt.go(-1)
    pageYOffset = await page.evaluate(() => window.pageYOffset)
    expect(pageYOffset).toBe(0)
    page.close()
  })

  test('/validate should display a 404', async () => {
    await page.nuxt.navigate('/validate')

    const error = await page.nuxt.errorData()

    expect(error.statusCode).toBe(404)
    expect(error.message).toBe('This page could not be found')
  })

  test('/validate-async should display a 404', async () => {
    await page.nuxt.navigate('/validate-async')

    const error = await page.nuxt.errorData()

    expect(error.statusCode).toBe(404)
    expect(error.message).toBe('This page could not be found')
  })

  test('/validate?valid=true', async () => {
    await page.nuxt.navigate('/validate?valid=true')

    expect(await page.$text('h1')).toBe('I am valid')
  })

  test('/validate-async?valid=true', async () => {
    await page.nuxt.navigate('/validate-async?valid=true')

    expect(await page.$text('h1')).toBe('I am valid')
  })

  test('/redirect', async () => {
    await page.nuxt.navigate('/redirect')

    expect(await page.$text('h1')).toBe('Index page')
  })

  test('/error', async () => {
    await page.nuxt.navigate('/error')

    expect(await page.nuxt.errorData()).toEqual({ message: 'Error mouahahah', statusCode: 500 })
    expect(await page.$text('.title')).toBe('Error mouahahah')
  })

  test('/error2', async () => {
    await page.nuxt.navigate('/error2')

    expect(await page.$text('.title')).toBe('Custom error')
    expect(await page.nuxt.errorData()).toEqual({ message: 'Custom error', statusCode: 500, customProp: 'ezpz' })
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
      () => window.location.href === 'https://nuxtjs.org/api/'
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

  test('/refresh-page-data', async () => {
    const page = await browser.page(url('/refresh-page-data'))
    let h1 = await page.$text('h1')
    expect(h1).toContain('Hello from server')
    await page.evaluate($nuxt => $nuxt.refresh(), page.$nuxt)
    h1 = await page.$text('h1')
    expect(h1).toContain('Hello from client')
    page.close()
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
