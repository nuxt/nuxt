import { loadFixture, Nuxt } from '../utils'

let nuxt = null

describe.skip.win('basic sockets', () => {
  beforeAll(async () => {
    const options = await loadFixture('sockets')
    nuxt = new Nuxt(options)
    await nuxt.listen()
  })

  test('/', async () => {
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<h1>Served over sockets!</h1>')).toBe(true)
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
