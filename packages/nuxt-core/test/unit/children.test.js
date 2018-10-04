import { loadFixture, getPort, Nuxt } from '../utils'

let port
// const url = (route) => 'http://localhost:' + port + route

let nuxt = null

describe('children', () => {
  beforeAll(async () => {
    const options = await loadFixture('children')
    nuxt = new Nuxt(options)
    port = await getPort()
    await nuxt.listen(port, 'localhost')
  })

  test('/parent', async () => {
    const { html } = await nuxt.renderRoute('/parent')
    expect(html.includes('<h1>I am the parent</h1>')).toBe(true)
  })

  test('/parent/child', async () => {
    const { html } = await nuxt.renderRoute('/parent/child')
    expect(html.includes('<h1>I am the parent</h1>')).toBe(true)
    expect(html.includes('<h2>I am the child</h2>')).toBe(true)
  })

  test('/parent should call _id.vue', async () => {
    const { html } = await nuxt.renderRoute('/parent')
    expect(html.includes('<h1>I am the parent</h1>')).toBe(true)
    expect(html.includes('<h2>Id=</h2>')).toBe(true)
  })

  test('/parent/1', async () => {
    const { html } = await nuxt.renderRoute('/parent/1')
    expect(html.includes('<h1>I am the parent</h1>')).toBe(true)
    expect(html.includes('<h2>Id=1</h2>')).toBe(true)
  })

  test('/parent/validate-child should display 404', async () => {
    const { html } = await nuxt.renderRoute('/parent/validate-child')
    expect(html.includes('This page could not be found')).toBe(true)
  })

  test('/parent/validate-child?key=12345', async () => {
    const { html } = await nuxt.renderRoute('/parent/validate-child?key=12345')
    expect(html.includes('<h1>I am the parent</h1>')).toBe(true)
    expect(html.includes('<h2>Child valid</h2>')).toBe(true)
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
