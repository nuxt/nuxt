import { loadFixture, getPort, Nuxt } from '../utils'

let port
let nuxt = null

describe('trailing-slash', () => {
  beforeAll(async () => {
    const options = await loadFixture('trailing-slash')
    nuxt = new Nuxt(options)
    await nuxt.ready()
    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('/', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('[pages/index]')
  })

  test('/posts', async () => {
    const { html } = await nuxt.server.renderRoute('/posts')
    expect(html).toContain('statusCode:404')
  })

  test('/posts/', async () => {
    const { html } = await nuxt.server.renderRoute('/posts/')
    expect(html).toContain('[pages/posts]')
    expect(html).toContain('[pages/posts/index]')
  })

  test('/posts/foo', async () => {
    const { html } = await nuxt.server.renderRoute('/posts/foo')
    expect(html).toContain('statusCode:404')
  })

  test('/posts/foo/', async () => {
    const { html } = await nuxt.server.renderRoute('/posts/foo/')
    expect(html).toContain('[pages/posts]')
    expect(html).toContain('[pages/posts/_slug]')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})

describe('trailing-slash-false', () => {
  beforeAll(async () => {
    const options = await loadFixture('trailing-slash-false')
    nuxt = new Nuxt(options)
    await nuxt.ready()
    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('/', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('[pages/index]')
  })

  test('/posts', async () => {
    const { html } = await nuxt.server.renderRoute('/posts')
    expect(html).toContain('[pages/posts]')
  })

  test('/posts/', async () => {
    const { html } = await nuxt.server.renderRoute('/posts/')
    expect(html).toContain('[pages/posts]')
    expect(html).toContain('[pages/posts/index]')
  })

  test('/posts/foo', async () => {
    const { html } = await nuxt.server.renderRoute('/posts/foo')
    expect(html).toContain('[pages/posts]')
    expect(html).toContain('[pages/posts/_slug]')
  })

  test('/posts/foo/', async () => {
    const { html } = await nuxt.server.renderRoute('/posts/foo/')
    expect(html).toContain('statusCode:404')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
