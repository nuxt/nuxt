import { loadFixture, getPort, Nuxt } from '../utils'

let port
// const url = (route) => 'http://localhost:' + port + route

let nuxt = null

describe('children', () => {
  beforeAll(async () => {
    const options = await loadFixture('children')
    nuxt = new Nuxt(options)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('/parent', async () => {
    const { html } = await nuxt.server.renderRoute('/parent')
    expect(html).toContain('<h1>I am the parent</h1>')
  })

  test('/parent/child', async () => {
    const { html } = await nuxt.server.renderRoute('/parent/child')
    expect(html).toContain('<h1>I am the parent</h1>')
    expect(html).toContain('<h2>I am the child</h2>')
  })

  test('/parent should call _id.vue', async () => {
    const { html } = await nuxt.server.renderRoute('/parent')
    expect(html).toContain('<h1>I am the parent</h1>')
    expect(html).toContain('<h2>Id=</h2>')
  })

  test('/parent/1', async () => {
    const { html } = await nuxt.server.renderRoute('/parent/1')
    expect(html).toContain('<h1>I am the parent</h1>')
    expect(html).toContain('<h2>Id=1</h2>')
  })

  test('/parent/validate-child should display 404', async () => {
    const { html } = await nuxt.server.renderRoute('/parent/validate-child')
    expect(html).toContain('This page could not be found')
  })

  test('/parent/validate-child?key=12345', async () => {
    const { html } = await nuxt.server.renderRoute('/parent/validate-child?key=12345')
    expect(html).toContain('<h1>I am the parent</h1>')
    expect(html).toContain('<h2>Child valid</h2>')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
