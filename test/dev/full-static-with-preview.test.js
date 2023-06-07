import http from 'http'
import { resolve } from 'path'
import serveStatic from 'serve-static'
import finalhandler from 'finalhandler'
import { Builder, Generator, getPort, loadFixture, Nuxt, waitFor } from '../utils'

let port
const url = route => 'http://localhost:' + port + route
const rootDir = resolve(__dirname, '..', 'fixtures/full-static-with-preview')
const distDir = resolve(rootDir, '.nuxt-generate')

let builder
let server = null
let generator = null

describe('full-static-with-preview', () => {
  beforeAll(async () => {
    const config = await loadFixture('full-static-with-preview', {
      generate: {
        static: false,
        dir: '.nuxt-generate'
      }
    })
    const nuxt = new Nuxt(config)
    await nuxt.ready()

    builder = new Builder(nuxt)
    builder.build = jest.fn()
    generator = new Generator(nuxt, builder)

    await generator.generate()

    const serve = serveStatic(distDir)
    server = http.createServer((req, res) => {
      serve(req, res, finalhandler(req, res))
    })

    port = await getPort()
    server.listen(port)
  })

  test('/', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<p>page-fetch-called</p>')
  })

  test('preview: /', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/?preview=true'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<p>page-fetch-called-in-preview</p>')
  })

  test('/with-component', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/with-component'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<p>page-fetch-called</p>')
    expect(html).toContain('<p>component-fetch-called</p>')
  })

  test('preview: /with-component', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/with-component?preview=true'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<p>page-fetch-called-in-preview</p>')
    expect(html).toContain('<p>component-fetch-called-in-preview</p>')
  })

  test('/with-nested-components', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/with-nested-components'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<p>page-fetch-called</p>')
    expect(html).toContain('<p>component-fetch-called</p>')
    expect(html).toContain('<p>sub-component-fetch-called</p>')
  })

  test('preview: /with-nested-components', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/with-nested-components?preview=true'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<p>page-fetch-called-in-preview</p>')
    expect(html).toContain('<p>component-fetch-called-in-preview</p>')
    expect(html).toContain('<p>sub-component-fetch-called-in-preview</p>')
  })

  test('/async-data-dependent-fetch', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/async-data-dependent-fetch'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<p>page-fetch-called</p>')
    expect(html).toContain('<p>component-1-fetch-called</p>')
    expect(html).toContain('<p>component-2-fetch-called</p>')
    expect(html).toContain('<p>component-3-fetch-called</p>')
  })

  test('preview: /async-data-dependent-fetch', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/async-data-dependent-fetch?preview=true'))
    await waitFor(100)
    const html = window.document.body.innerHTML
    expect(html).toContain('<p>page-fetch-called-in-preview</p>')
    expect(html).toContain('<p>component-1-fetch-called-in-preview</p>')
    expect(html).toContain('<p>component-2-fetch-called-in-preview</p>')
    expect(html).toContain('<p>component-3-fetch-called-in-preview</p>')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await server.close()
  })
})
