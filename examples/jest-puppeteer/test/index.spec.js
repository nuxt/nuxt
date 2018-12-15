const devices = require('puppeteer/DeviceDescriptors')
const iPhone = devices['iPhone 6']

const BASE_URL = 'http://127.0.0.1:3000'

describe('Index page', () => {
  let page
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    page = await browser.newPage()
    await page.emulate(iPhone)
    await page.goto(BASE_URL)
  })

  afterAll(async () => {
    await page.close()
  })

  it('test index title', async () => {
    expect.assertions(1)
    const title = await page.evaluate(() => document.title)
    expect(title).toMatchSnapshot('index.title')
  })

  it('test navigation to about page', async () => {
    expect.assertions(1)
    await page.click('a#about-link')
    await page.waitForSelector('p#hello-msg')
    const msg = await page.$eval('p#hello-msg', e => e.textContent)
    expect(msg).toMatchSnapshot('about.msg')
  })
})
