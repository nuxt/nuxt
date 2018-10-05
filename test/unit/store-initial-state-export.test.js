import Browser from '../utils/browser'
import { loadFixture, getPort, Nuxt } from '../utils'

let port
const browser = new Browser()
const url = route => 'http://localhost:' + port + route

let nuxt = null
let page = null

describe('store initialState export', () => {
  beforeAll(async () => {
    const config = await loadFixture('store-initial-state-export')
    nuxt = new Nuxt(config)
    port = await getPort()
    await nuxt.listen(port, 'localhost')

    await browser.start()
    page = await browser.page(url('/'))
  })

  test('initial value is present in the h1 element', async () => {
    expect(await page.$text('h1')).toBe('0')
  })

  test('after state change, the mutated value is present in the h1 element', async () => {
    await page.click('#changeState')
    expect(await page.$text('h1')).toBe('1')
  })

  afterAll(async () => {
    await page.close()
    await browser.close()
    await nuxt.close()
  })
})
