import { loadFixture, Nuxt } from '../utils'

let nuxt = null

describe.skip.win('basic sockets', () => {
  beforeAll(async () => {
    const options = await loadFixture('sockets')
    nuxt = new Nuxt(options)
    await nuxt.server.listen()
  })

  test('/', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<h1>Served over sockets!</h1>')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
