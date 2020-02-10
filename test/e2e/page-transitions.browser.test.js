import Browser from '../utils/browser'
import { loadFixture, getPort, Nuxt } from '../utils'

let port
const browser = new Browser()
const url = route => 'http://localhost:' + port + route

let nuxt = null
let page = null

const parseEvents = async (page) => {
  const events = await page.evaluate(() => [...document.querySelectorAll('#transition-events li')].map(li => li.textContent))
  return events.map(event => event.split('|'))
}

describe('page transitions (browser)', () => {
  beforeAll(async () => {
    const config = await loadFixture('page-transitions')
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

  test('Root page callbacks', async () => {
    await page.nuxt.navigate('/callbacks')
    const events = await parseEvents(page)
    expect(events).toEqual(
      [
        ['index', 'beforeLeave'],
        ['index', 'leave'],
        ['index', 'afterLeave'],
        ['callbacks', 'beforeEnter'],
        ['callbacks', 'enter'],
        ['callbacks', 'afterEnter']
      ]
    )
  })

  test('Parent -> Child page callbacks', async () => {
    await page.nuxt.navigate('/callbacks/child')
    const events = await parseEvents(page)
    expect(events).toEqual(
      [
        ['callbacks-child', 'beforeEnter'],
        ['callbacks-child', 'enter'],
        ['callbacks-child', 'afterEnter']
      ]
    )
  })

  test('Child -> Parent page callbacks', async () => {
    await page.nuxt.navigate('/callbacks')
    const events = await parseEvents(page)
    expect(events).toEqual(
      [
        ['callbacks-child', 'beforeLeave'],
        ['callbacks-child', 'leave'],
        ['callbacks-child', 'afterLeave']
      ]
    )
  })

  test('Root page transition properties', async () => {
    await page.nuxt.navigate('/transition-properties')
    const transitionsData = await page.nuxt.transitionsData()
    expect(transitionsData.length).toBe(1)
    expect(transitionsData[0].name).toBe('custom')
    expect(transitionsData[0].appear).toBe(true)
    expect(transitionsData[0].css).toBe(false)
    expect(transitionsData[0].mode).toBe('in-out')
    expect(transitionsData[0].duration).toBe(3000)
  })

  test('Parent -> child transition properties', async () => {
    await page.nuxt.navigate('/transition-properties/child')
    const transitionsData = await page.nuxt.transitionsData()
    expect(transitionsData.length).toBe(2)
    expect(transitionsData[0].name).toBe('custom')
    expect(transitionsData[1].name).toBe('custom-child')
  })

  test('Child -> parent transition properties', async () => {
    await page.nuxt.navigate('/transition-properties')
    const transitionsData = await page.nuxt.transitionsData()
    expect(transitionsData.length).toBe(2)
    expect(transitionsData[0].name).toBe('custom')
    expect(transitionsData[1].name).toBe('custom-child')
  })

  afterAll(async () => {
    await nuxt.close()
  })

  // Stop browser
  afterAll(async () => {
    await page.close()
    await browser.close()
  })
})
