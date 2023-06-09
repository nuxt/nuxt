import Browser from '../utils/browser'
import { loadFixture, getPort, Nuxt, waitFor } from '../utils'

let port
const browser = new Browser()
const url = route => 'http://localhost:' + port + route

let nuxt = null
let page = null

describe('basic browser navigation', () => {
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

  const TEST_PATHS = [
    'asyncData-error',
    'asyncData-throw',
    'middleware-asyncData-error',
    'middleware-asyncData-throw'
  ]

  for (const path of TEST_PATHS) {
    test(`Navigate away from /navigation/${path}`, async () => {
      page = await browser.page(url('/'))
      expect(await page.$text('h1')).toBe('Index page')

      await page.nuxt.navigate('/navigation')
      expect(await page.$text('h3')).toContain('Click one of the links below')

      await page.nuxt.navigate(`/navigation/${path}`, /* waitEnd */false)
      await waitFor(nuxt.options.loading.throttle + 100)
      const loading = await page.nuxt.loadingData()
      expect(loading.show).toBe(true)

      await page.nuxt.go(-1)
      await page.waitForFunction(
        '$nuxt.$loading.$data.show === false'
      )
      expect(await page.$text('h1')).toBe('Index page')

      await waitFor(2000)

      expect(await page.$text('h1')).toBe('Index page')
    })
  }

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
