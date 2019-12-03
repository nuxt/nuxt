import { resolve } from 'path'
import { promisify } from 'util'
import fs from 'fs'
import { getPort, loadFixture, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe('custom-dirs', () => {
  beforeAll(async () => {
    const config = await loadFixture('custom-dirs')
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('custom assets directory', async () => {
    const readFile = promisify(fs.readFile)

    const extractedIndexCss = resolve(__dirname, '..', 'fixtures/custom-dirs/.nuxt/dist/client/app.css')
    const content = await readFile(extractedIndexCss, 'utf-8')

    expect(content).toContain('.global-css-selector{color:red}')
  })

  test('custom layouts directory', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<p>I have custom layouts directory</p>')
  })

  test('custom middleware directory', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/user-agent'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<pre>Mozilla')
  })

  test('custom pages directory', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<h1>I have custom pages directory</h1>')
  })

  test('custom static directory', async () => {
    const { headers } = await rp(url('/test.txt'))
    expect(headers['cache-control']).toBe('public, max-age=0')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
