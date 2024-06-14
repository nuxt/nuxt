import Browser from '../utils/browser'
import { loadFixture, getPort, Nuxt } from '../utils'

let port
const browser = new Browser()
const url = route => 'http://localhost:' + port + route

let nuxt = null
let page = null

describe('page mount times while changing layouts', () => {
  beforeAll(async () => {
    const config = await loadFixture('page-mount-with-layouts')
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
    await browser.start()
    page = await browser.page(url('/page-1'))
  })

  test('Open /page-1 and mount 1 times', async () => {
    expect(await page.$text('h1')).toBe('Layout 1')
    expect(await page.$text('h2')).toBe('Page 1')
    expect(await page.evaluate(() => window.mountedCount)).toEqual(1)
  })

  test('Change layout and mount 2 times', async () => {
    page = await browser.page(url('/page-1'))

    await page.nuxt.navigate('/page-2')

    expect(await page.$text('h1')).toBe('Layout 2')
    expect(await page.$text('h2')).toBe('Page 2')
    expect(await page.evaluate(() => window.mountedCount)).toEqual(2)
  })

  test('Change layout multiple times', async () => {
    page = await browser.page(url('/page-2'))

    await page.nuxt.navigate('/page-1')

    expect(await page.$text('h1')).toBe('Layout 1')
    expect(await page.$text('h2')).toBe('Page 1')
    expect(await page.evaluate(() => window.mountedCount)).toEqual(2)

    await page.nuxt.navigate('/page-2')

    expect(await page.evaluate(() => window.mountedCount)).toEqual(3)

    await page.nuxt.navigate('/page-1')

    expect(await page.evaluate(() => window.mountedCount)).toEqual(4)

    await page.nuxt.navigate('/page-1', false)

    expect(await page.evaluate(() => window.mountedCount)).toEqual(4)
  })

  test('Open 404 error-page and mount 1 times', async () => {
    page = await browser.page(url('/404'))

    expect(await page.$text('h1')).toBe('Layout error')
    expect(await page.$text('h2')).toBe('Error page 404')
    expect(await page.evaluate(() => window.mountedCount)).toEqual(1)
  })

  test('Open another error-page and mount 1 times', async () => {
    page = await browser.page(url('/403'))

    expect(await page.$text('h1')).toBe('Layout error')
    expect(await page.$text('h2')).toBe('Error page 403')
    expect(await page.evaluate(() => window.mountedCount)).toEqual(1)
  })

  test('Change error layout to common', async () => {
    page = await browser.page(url('/404'))

    await page.nuxt.navigate('/page-1')

    expect(await page.$text('h1')).toBe('Layout 1')
    expect(await page.$text('h2')).toBe('Page 1')
    expect(await page.evaluate(() => window.mountedCount)).toEqual(2)
  })

  test('Change common layout to error', async () => {
    page = await browser.page(url('/page-1'))

    await page.nuxt.navigate('/404')

    expect(await page.$text('h1')).toBe('Layout error')
    expect(await page.$text('h2')).toBe('Error page 404')
    expect(await page.evaluate(() => window.mountedCount)).toEqual(2)
  })
})
