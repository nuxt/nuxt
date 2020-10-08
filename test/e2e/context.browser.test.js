import Browser from '../utils/browser'
import { loadFixture, getPort, Nuxt } from '../utils'

let port
const browser = new Browser()
const url = route => 'http://localhost:' + port + route

let nuxt = null
let page1 = null
let page2 = null

describe('server shared context', () => {
  beforeAll(async () => {
    const config = await loadFixture('context')
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')

    await browser.start({
      // slowMo: 50,
      headless: false
    })
  })

  it('does not have shared context', async () => {
    ;[page1, page2] = await Promise.all([
      browser.page(url('/about')),
      browser.page(url('/about/another'))
    ])

    const [page1Text, page2ParentText, page2ChildText] = await Promise.all([
      page1.$text('[data-test="parent"]'),
      page2.$text('[data-test="parent"]'),
      page2.$text('[data-test="child"]')
    ])

    expect(page1Text).toContain('vm: /about')
    expect(page1Text).toContain('context: /about')

    for (const text of [page2ParentText, page2ChildText]) {
      expect(text).toContain('vm: /about/another')
      expect(text).toContain('context: /about/another')
    }
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })

  // Stop browser
  afterAll(async () => {
    await Promise.all([
      page1.close(),
      page2.close()
    ])
    await browser.close()
  })
})
