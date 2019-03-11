import { loadFixture, Nuxt } from '../utils'

describe.posix('basic sockets', () => {
  test('/', async () => {
    const options = await loadFixture('sockets')
    const nuxt = new Nuxt(options)
    await nuxt.ready()

    await nuxt.server.listen()

    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<h1>Served over sockets!</h1>')

    await nuxt.close()
  })
})
