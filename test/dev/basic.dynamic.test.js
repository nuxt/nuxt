import path from 'path'
import { readFileSync } from 'fs'
import { ResourceLoader } from 'jsdom'

import { loadFixture, getPort, Nuxt, Builder } from '../utils'

let fetchCount = 0

class ProxyLoader extends ResourceLoader {
  fetch (url, options) {
    if (url.startsWith('https://cdn.nuxtjs.org')) {
      fetchCount++
      const param = url.slice('https://cdn.nuxtjs.org'.length + 1)
      const file = path.join(nuxt.options.buildDir, 'dist/client', param)
      const fileContents = readFileSync(file, 'utf-8')
      return Promise.resolve(Buffer.from(fileContents))
    }

    return super.fetch(url, options)
  }
}
const resourceLoader = new ProxyLoader()

let port
let nuxt
const url = route => 'http://localhost:' + port + route

describe('basic ssr', () => {
  beforeAll(async () => {
    const options = await loadFixture('basic')
    const builderNuxt = new Nuxt(options)
    await builderNuxt.ready()

    const builder = new Builder(builderNuxt)

    await builder.build()

    const runOptions = await loadFixture('basic', {
      router: {
        base: '/path'
      },
      build: {
        publicPath: 'https://cdn.nuxtjs.org'
      }
    })
    nuxt = new Nuxt(runOptions)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')
  })

  test('dynamic config is injected', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/path/'), { resources: resourceLoader })

    expect(window.document.body.innerHTML).toContain('<h1>Index page</h1>')

    expect(window.__NUXT__.config._app.basePath).toBe('/path/')
    expect(window.__NUXT__.config._app.cdnURL).toBe('https://cdn.nuxtjs.org/')
    expect(window.__NUXT__.config._app.assetsPath).toBe('/')

    expect(fetchCount).toBeGreaterThan(0)
  })

  test('dynamic publicPath is used in ssr html', async () => {
    const { html } = await nuxt.server.renderRoute('/', {
      resources: resourceLoader
    })

    expect(html).toContain('<img src="https://cdn.nuxtjs.org/img')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
