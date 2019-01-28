import { loadFixture, Nuxt } from '../utils'

let nuxt = null

describe.skip.win('basic sockets', () => {
  test('/', async () => {
    const options = await loadFixture('sockets')
    nuxt = new Nuxt(options)
    await nuxt.server.listen()

    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<h1>Served over sockets!</h1>')

    await nuxt.close()
  })
})
