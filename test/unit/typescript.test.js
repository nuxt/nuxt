import { loadFixture, getPort, Nuxt, rp } from '../utils'

describe('typescript', () => {
  let nuxt
  let port
  const url = route => 'http://localhost:' + port + route

  beforeAll(async () => {
    const options = await loadFixture('typescript')
    nuxt = new Nuxt(options)
    await nuxt.ready()
    port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')
  })

  test('/', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<div>Index Page</div>')
  })

  test('/about', async () => {
    const { html } = await nuxt.server.renderRoute('/about')
    expect(html).toContain('<div>About Page</div>')
  })

  test('/interface', async () => {
    const { html } = await nuxt.server.renderRoute('/interface')
    expect(html).toContain('<div>Interface Page</div>')
  })

  test('/contact', async () => {
    const { html } = await nuxt.server.renderRoute('/contact')
    expect(html).toContain('<div>Contact Page</div>')
  })

  test('/api/test', async () => {
    const html = await rp(url('/api/test'))
    expect(html).toContain('Works!')
  })

  test('TS module successfully required', () => {
    expect(nuxt.moduleContainer.requiredModules).toHaveProperty('~/modules/module')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
