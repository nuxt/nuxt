import Browser from '../utils/browser'
import { loadFixture, getPort, Nuxt } from '../utils'

let port
const browser = new Browser()
const url = route => 'http://127.0.0.1:' + port + route

let nuxt = null

describe('spa router base browser', () => {
  beforeAll(async () => {
    const config = await loadFixture('spa-base')
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, '127.0.0.1')

    await browser.start({
      // slowMo: 50,
      // headless: false
    })
  })

  test('Open /app (router base)', async () => {
    const page = await browser.page(url('/app'))

    expect(await page.evaluate(() => location.href)).toBe(url('/app/'))

    expect(await page.html()).not.toContain('This page could not be found')

    expect(await page.evaluate(() => {
      const headings = document.evaluate("//div[text()='Hello SPA!']", document, null, XPathResult.ANY_TYPE, null)
      return headings.iterateNext()
    })).not.toBe(null)
    await page.close()
  })

  test('Open /app/ (router base with trailing slash)', async () => {
    const page = await browser.page(url('/app/'))

    expect(await page.evaluate(() => location.href)).toBe(url('/app/'))

    expect(await page.html()).not.toContain('This page could not be found')
    await page.close()
  })

  test('Open /app/mounted', async () => {
    const page = await browser.page(url('/app/mounted'))

    expect(await page.$text('h1')).toMatch('Test: updated')
    await page.close()
  })

  test('/app/unknown', async () => {
    const page = await browser.page(url('/app/unknown'))

    expect(await page.evaluate(() => location.href)).toBe(url('/app/unknown'))

    expect(await page.html()).toContain('This page could not be found')
    await page.close()
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })

  // Stop browser
  afterAll(async () => {
    await browser.close()
  })
})
