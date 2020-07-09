import Browser from '../utils/browser'
import { loadFixture, getPort, Nuxt } from '../utils'

let port
const browser = new Browser()
const url = route => 'http://localhost:' + port + route

let nuxt = null
let page = null

describe('spa router base browser', () => {
  beforeAll(async () => {
    const config = await loadFixture('spa-base')
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')

    await browser.start({
      // slowMo: 50,
      // headless: false
    })
  })

  test('Open /app (router base)', async () => {
    page = await browser.page(url('/app'))

    expect(await page.evaluate(() => location.href)).toBe(url('/app'))

    expect(await page.html()).not.toContain('This page could not be found')

    expect(await page.evaluate(() => {
      const headings = document.evaluate("//div[text()='Hello SPA!']", document, null, XPathResult.ANY_TYPE, null)
      return headings.iterateNext()
    })).not.toBe(null)
  })

  test('Open /app/ (router base with trailing slash)', async () => {
    page = await browser.page(url('/app/'))

    expect(await page.evaluate(() => location.href)).toBe(url('/app/'))

    expect(await page.html()).not.toContain('This page could not be found')
  })

  test('Open /app/mounted', async () => {
    page = await browser.page(url('/app/mounted'))

    expect(await page.$text('h1')).toMatch('Test: updated')
  })

  test('/app/unknown', async () => {
    page = await browser.page(url('/app/unknown'))

    expect(await page.evaluate(() => location.href)).toBe(url('/app/unknown'))

    expect(await page.html()).toContain('This page could not be found')
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
