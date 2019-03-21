import Browser from '../utils/browser'
import { getPort, loadFixture, Nuxt } from '../utils'

let port
const browser = new Browser()
const url = route => 'http://localhost:' + port + route

let nuxt = null
let page = null

const startServer = async (type = 'basic') => {
  const config = await loadFixture(type)
  nuxt = new Nuxt(config)
  await nuxt.ready()

  port = await getPort()
  await nuxt.server.listen(port, 'localhost')

  return nuxt
}

describe('basic vue-config', () => {
  beforeAll(async () => {
    await browser.start({
      // slowMo: 50,
      // headless: false
    })
  })

  test('default', async () => {
    nuxt = await startServer()
    expect(nuxt.options.vue.config).toEqual({ silent: true, performance: false })
    page = await browser.page(url('/config'))

    expect(await page.$text('#silent', true)).toBe('true')
    expect(await page.$text('#performance', true)).toBe('false')
  })

  test('explicit', async () => {
    nuxt = await startServer('config-explicit')
    page = await browser.page(url('/config'))

    expect(nuxt.options.vue.config).toEqual({ silent: false, performance: true, devtools: true })

    expect(await page.$text('#silent', true)).toBe('false')
    expect(await page.$text('#performance', true)).toBe('true')
    expect(await page.$text('#devtools', true)).toBe('true')
  })

  afterEach(async () => {
    await nuxt.close()
  })

  afterAll(async () => {
    await page.close()
    await browser.close()
  })
})
