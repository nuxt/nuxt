import { loadFixture, getPort, Nuxt } from '../utils'

let nuxt = null

describe('meta-attrs', () => {
  beforeAll(async () => {
    const options = await loadFixture('meta-attrs')
    nuxt = new Nuxt(options)
    await nuxt.server.listen(await getPort(), '0.0.0.0')
  })

  test('/', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<html data-n-head-ssr foo="baz" data-n-head="foo">')
    expect(html).toContain('<head bar="foo" data-n-head="bar">')
    expect(html).toContain('<body baz="bar" data-n-head="baz">')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
