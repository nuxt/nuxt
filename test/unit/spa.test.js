import consola from 'consola'
import mockLog from '../utils/mock-log'
import { loadFixture, getPort, Nuxt } from '../utils'

let nuxt = null

let port
const url = route => 'http://localhost:' + port + route

const renderRoute = async _url => {
  const window = await nuxt.renderAndGetWindow(url(_url))
  const head = window.document.head.innerHTML
  const html = window.document.body.innerHTML
  return { window, head, html }
}

describe('spa', () => {
  mockLog(['log'], consola)

  beforeAll(async () => {
    const config = loadFixture('spa')
    nuxt = new Nuxt(config)
    port = await getPort()
    await nuxt.listen(port, 'localhost')
  })

  test('/ (basic spa)', async () => {
    const { html } = await renderRoute('/')
    expect(html).toMatch('Hello SPA!')
    expect(consola.log).not.toHaveBeenCalledWith('created')
    expect(consola.log).toHaveBeenCalledWith('mounted')
  })

  test('/custom (custom layout)', async () => {
    const { html } = await renderRoute('/custom')
    expect(html).toMatch('Custom layout')
    expect(consola.log).toHaveBeenCalledWith('created')
    expect(consola.log).toHaveBeenCalledWith('mounted')
  })

  test('/mounted', async () => {
    const { html } = await renderRoute('/mounted')
    expect(html).toMatch('<h1>Test: updated</h1>')
  })

  test('/_nuxt/ (access publicPath in spa mode)', async () => {
    await expect(renderRoute('/_nuxt/')).rejects.toMatchObject({
      response: {
        statusCode: 404,
        statusMessage: 'ResourceNotFound'
      }
    })
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
