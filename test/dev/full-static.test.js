import http from 'http'
import { join, resolve } from 'upath'
import serveStatic from 'serve-static'
import finalhandler from 'finalhandler'
import glob from 'glob'
import { Builder, Generator, getPort, loadFixture, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route
const rootDir = resolve(__dirname, '..', 'fixtures/full-static')
const distDir = resolve(rootDir, '.nuxt-generate')

let builder
let server = null
let generator = null

const generateAndStartServer = async (overrides) => {
  const config = await loadFixture('full-static', {
    generate: {
      static: false,
      dir: '.nuxt-generate'
    },
    ...(overrides || {})
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
}

describe('full-static', () => {
  describe('with scripts', () => {
    beforeAll(async () => await generateAndStartServer())

    test('/payload (custom build.publicPath)', async () => {
      const { body: html } = await rp(url('/payload'))

      expect(html).toContain('<script src="https://cdn.nuxtjs.org/test/')
      expect(html).toContain(
        '<link rel="preload" href="https://cdn.nuxtjs.org/test/_nuxt/static/'
      )
    })

    test('/encoding/中文', async () => {
      const { body: html } = await rp(url('/encoding/中文'))

      const paths = ['encoding/中文/state.js', 'encoding/中文/payload.js']

      paths.forEach((path) => {
        const files = glob.sync(join(distDir, '**', path))
        expect(html).toContain(encodeURI(path))
        expect(files).toContainEqual(expect.stringContaining(path))
      })
    })

    // Close server and ask nuxt to stop listening to file changes
    afterAll(async () => {
      await server.close()
    })
  })

  describe('without scripts', () => {
    beforeAll(async () => await generateAndStartServer({ render: { injectScripts: false } }))

    test('should not inject scripts', async () => {
      const { body: html } = await rp(url('/payload'))

      expect(html).not.toContain('<script')
      expect(html).not.toContain('<link')
    })

    // Close server and ask nuxt to stop listening to file changes
    afterAll(async () => {
      await server.close()
    })
  })
})
