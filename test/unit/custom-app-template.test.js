import { getPort, loadFixture, Nuxt } from '../utils'

let options

describe('custom-app-template', () => {
  beforeAll(async () => {
    options = await loadFixture('custom-app-template')
  })

  test('Home page with google analytics', async () => {
    const nuxt = new Nuxt(options)
    await nuxt.ready()

    const port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')

    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<p>My Template</p>')
    expect(html).toContain('<h1>Custom!</h1>')
    expect(html).toContain('Google Analytics')

    await nuxt.close()
  })

  test('Home page with heap analytics', async () => {
    const nuxt = new Nuxt(options)
    options.env.tracker = 'heap'
    await nuxt.ready()

    const port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')

    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<p>My Template</p>')
    expect(html).toContain('<h1>Custom!</h1>')
    expect(html).toContain('Heap Analytics')

    await nuxt.close()
  })

  test('Home page with no analytics', async () => {
    const nuxt = new Nuxt(options)
    options.env.tracker = '-'
    await nuxt.ready()

    const port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')

    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<p>My Template</p>')
    expect(html).toContain('<h1>Custom!</h1>')
    expect(html).not.toContain('google Analytics')
    expect(html).not.toContain('Heap Analytics')

    await nuxt.close()
  })
})
