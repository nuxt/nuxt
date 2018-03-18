import rp from 'request-promise-native'
import { Nuxt, Builder } from '..'
import { loadConfig } from './helpers/config'

const port = 4007
const url = route => 'http://localhost:' + port + route

let nuxt = null
let builder = null

describe('custom-dirs', () => {
  // Init nuxt.js and create server listening on localhost:4000
  beforeAll(async () => {
    const config = loadConfig('/custom-dirs', { dev: false })

    nuxt = new Nuxt(config)
    builder = new Builder(nuxt)
    await builder.build()
    await nuxt.listen(4007, 'localhost')
  }, 30000)

  test('custom assets directory', async () => {
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('.global-css-selector')).toBe(true)
  })

  test('custom layouts directory', async () => {
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<p>I have custom layouts directory</p>')).toBe(true)
  })

  test('custom middleware directory', async () => {
    const window = await nuxt.renderAndGetWindow(url('/user-agent'))
    const html = window.document.body.innerHTML
    expect(html.includes('<pre>Mozilla')).toBe(true)
  })

  test('custom pages directory', async () => {
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<h1>I have custom pages directory</h1>')).toBe(true)
  })

  test('custom static directory', async () => {
    const { headers } = await rp(url('/test.txt'), {
      resolveWithFullResponse: true
    })
    expect(headers['cache-control']).toBe('public, max-age=0')
  })

  // Close server and ask nuxt to stop listening to file changes
  test('Closing server and nuxt.js', async () => {
    await nuxt.close()
  })
})
