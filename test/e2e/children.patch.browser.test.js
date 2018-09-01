import Browser from '../utils/browser'
import { loadFixture, getPort, Nuxt, Utils } from '../utils'

let port
const browser = new Browser()
const url = route => 'http://localhost:' + port + route

let nuxt = null
let page
const dates = {}

describe('children patch (browser)', () => {
  beforeAll(async () => {
    const options = await loadFixture('children')
    nuxt = new Nuxt(options)
    port = await getPort()
    await nuxt.listen(port, 'localhost')
  })

  test('Start browser', async () => {
    expect.assertions(0) // suppress 'no assertions' warning
    await browser.start({
      // slowMo: 50,
      // headless: false
    })
  })

  test('Loading /patch and keep ', async () => {
    page = await browser.page(url('/patch'))

    const h1 = await page.$text('h1')
    expect(h1.includes('patch:')).toBe(true)
    const h2 = await page.$text('h2')
    expect(h2).toBe('Index')
    dates.patch = await page.$text('[data-date-patch]')
  })

  test('Navigate to /patch/1', async () => {
    const { hook } = await page.nuxt.navigate('/patch/1', false)
    const loading = await page.nuxt.loadingData()
    expect(loading.show).toBe(true)
    await hook

    const h2 = await page.$text('h2')
    expect(h2.includes('_id:')).toBe(true)
    dates.id = await page.$text('[data-date-id]')

    expect(dates.patch).toBe(await page.$text('[data-date-patch]'))
  })

  test('Navigate to /patch/2', async () => {
    await page.nuxt.navigate('/patch/2')
    const date = await page.$text('[data-date-id]')

    expect(await page.$text('h3')).toBe('Index')
    expect(dates.patch).toBe(await page.$text('[data-date-patch]'))
    expect(+dates.id < +date).toBe(true)
    dates.id = date
  })

  test('Navigate to /patch/2?test=true', async () => {
    await page.nuxt.navigate('/patch/2?test=true')
    expect(dates.patch).toBe(await page.$text('[data-date-patch]'))
    expect(dates.id).toBe(await page.$text('[data-date-id]'))
  })

  test('Navigate to /patch/2#test', async () => {
    await page.nuxt.navigate('/patch/2#test')
    expect(dates.patch).toBe(await page.$text('[data-date-patch]'))
    expect(dates.id).toBe(await page.$text('[data-date-id]'))
  })

  test('Navigate to /patch/2/child', async () => {
    await page.nuxt.navigate('/patch/2/child')
    dates.child = await page.$text('[data-date-child]')
    dates.slug = await page.$text('[data-date-child-slug]')

    expect(dates.patch).toBe(await page.$text('[data-date-patch]'))
    expect(dates.id).toBe(await page.$text('[data-date-id]'))
    expect(+dates.child > +dates.id).toBe(true)
    expect(+dates.slug > +dates.child).toBe(true)
  })

  test('Navigate to /patch/2/child/1', async () => {
    await page.nuxt.navigate('/patch/2/child/1')
    const date = await page.$text('[data-date-child-slug]')

    expect(dates.patch).toBe(await page.$text('[data-date-patch]'))
    expect(dates.id).toBe(await page.$text('[data-date-id]'))
    expect(dates.child).toBe(await page.$text('[data-date-child]'))
    expect(+date > +dates.slug).toBe(true)
    dates.slug = date
  })

  test('Navigate to /patch/2/child/1?foo=bar', async () => {
    await page.nuxt.navigate('/patch/2/child/1?foo=bar')

    expect(dates.patch).toBe(await page.$text('[data-date-patch]'))
    expect(dates.id).toBe(await page.$text('[data-date-id]'))
    expect(dates.child).toBe(await page.$text('[data-date-child]'))
    expect(dates.slug).toBe(await page.$text('[data-date-child-slug]'))
  })

  test('Search a country', async () => {
    const countries = await page.$$text('[data-test-search-result]')
    expect(countries.length).toBe(5)

    await page.type('[data-test-search-input]', 'gu')

    await Utils.waitFor(250)
    const newCountries = await page.$$text('[data-test-search-result]')
    expect(newCountries.length).toBe(1)
    expect(newCountries).toEqual(['Guinea'])
    expect(await page.nuxt.routeData()).toEqual({
      path: '/patch/2/child/1',
      query: {
        foo: 'bar',
        q: 'gu'
      }
    })
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
