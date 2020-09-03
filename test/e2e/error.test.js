import Browser from '../utils/browser'
import { loadFixture, getPort, Nuxt } from '../utils'

let port
const browser = new Browser()
const url = route => 'http://localhost:' + port + route

let nuxt = null
let page = null

describe('basic browser', () => {
  beforeAll(async () => {
    const config = await loadFixture('error')
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

    expect(await page.$text('h1')).toBe('Error Loop incoming page')
  })

  test('/squared doesnt loop due to error on error page', async () => {
    await page.nuxt.navigate('/squared')

    expect(await page.$text('header')).toBe('Error layout')
    expect(await page.$text('h2')).toBe('An error occurred while showing the error page')
  })

  test('/about loads normally', async () => {
    await page.nuxt.navigate('/about')

    expect(await page.$text('h1')).toBe('About')
  })

  test('/about error layout after click', async () => {
    const transitionPromise = page.evaluate(async ($nuxt) => {
      await new Promise(resolve => $nuxt.$once('triggerScroll', resolve))
    }, page.$nuxt)

    await page.click('button')
    await transitionPromise
    expect(await page.$text('header')).toBe('Error layout')
  })

  test('/info prints empty page', async () => {
    await page.nuxt.navigate('/info')

    expect(await page.$text('#__layout')).toBe('')
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
