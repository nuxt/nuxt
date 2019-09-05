import { loadFixture, getPort, Nuxt } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe('symlinks', () => {
  beforeAll(async () => {
    const options = await loadFixture('symlinks')
    nuxt = new Nuxt(options)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')
  })

  test('/', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<h1>Index page</h1>')
  })

  test('/symlink/symlinked', async () => {
    const { html } = await nuxt.server.renderRoute('/symlink/symlinked')
    expect(html).toContain('<h1>Symlinked page</h1>')
  })

  test('/symlink/deep/nested-symlinked', async () => {
    const { html } = await nuxt.server.renderRoute('/symlink/deep/nested-symlinked')
    expect(html).toContain('<h1>Nested symlink page</h1>')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
