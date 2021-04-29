import http from 'http'
import { resolve } from 'path'
import serveStatic from 'serve-static'
import finalhandler from 'finalhandler'
import { Builder, Generator, getPort, loadFixture, Nuxt } from '../utils'
import renderAndGetWindow from '../../packages/server/src/jsdom'

let port
const url = route => 'http://localhost:' + port + route

let builder
let server = null
let generator = null

const fixtures = [
  ['trailing-slash/with-true', '/posts/test/'],
  ['trailing-slash/with-false', '/posts/test'],
  ['trailing-slash/with-default', '/posts/test'],
  ['trailing-slash/with-default', '/posts/test/']
]

fixtures.forEach(([fixture, path]) => {
  describe(`trailing-slash payloads (${fixture})`, () => {
    beforeAll(async () => {
      const dir = `.nuxt-generate-${fixture.replace('/', '_')}`
      const rootDir = resolve(__dirname, '../fixtures', fixture)
      const distDir = resolve(rootDir, dir)

      const config = await loadFixture(fixture, {
        static: true,
        generate: {
          dir,
          routes: [path]
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

    test(`payload hydration ${path}`, async () => {
      const window = await renderAndGetWindow(url(path), {}, { loadedCallback: '_onNuxtLoaded', globals: { id: '__nuxt' } })
      expect(window.__NUXT__.fetch).toEqual({ 0: { result: 'fetched' } })
    })

    // Close server and ask nuxt to stop listening to file changes
    afterAll(async () => {
      await server.close()
    })
  })
})
