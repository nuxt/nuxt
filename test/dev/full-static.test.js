import http from 'http'
import { resolve } from 'path'
import serveStatic from 'serve-static'
import finalhandler from 'finalhandler'
import { Builder, Generator, getPort, loadFixture, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route
const rootDir = resolve(__dirname, '..', 'fixtures/full-static')
const distDir = resolve(rootDir, '.nuxt-generate')

let builder
let server = null
let generator = null

describe('full-static', () => {
  beforeAll(async () => {
    const config = await loadFixture('full-static', {
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

  test('/payload (custom build.publicPath)', async () => {
    const { body: html } = await rp(url('/payload'))

    expect(html).toContain('<script src="https://cdn.nuxtjs.org/test/')
    expect(html).toContain('<link rel="preload" href="https://cdn.nuxtjs.org/test/_nuxt/static/')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await server.close()
  })
})
