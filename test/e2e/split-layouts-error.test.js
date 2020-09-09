import Browser from '../utils/browser'
import { loadFixture, getPort, Nuxt } from '../utils'

let port
const browser = new Browser()
const url = route => 'http://localhost:' + port + route

let nuxt = null
let page = null

describe('split layouts error layout', () => {
  beforeAll(async () => {
    const config = await loadFixture('split-layouts-error')
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
    await browser.start()
    page = await browser.page(url('/'))
  })

  test('Open /', async () => {
    expect(await page.$text('h1')).toBe('Error Loop incoming page')
  })

  test('/info has error layout', async () => {
    await page.nuxt.navigate('/info')

    const transitionPromise = page.evaluate(async ($nuxt) => {
      await new Promise(resolve => $nuxt.$once('triggerScroll', resolve))
    }, page.$nuxt)
    await page.click('button')

    await transitionPromise

    expect(await page.$text('header')).toBe('Error layout')
  })

  test('/error has error layout after router push', async () => {
    await page.nuxt.navigate('/error')

    expect(await page.$text('header')).toBe('Error layout')
  })

  test('/error has error layout after page load', async () => {
    const localPage = await browser.page(url('/error'))

    expect(await localPage.$text('header')).toBe('Error layout')
  })
})
