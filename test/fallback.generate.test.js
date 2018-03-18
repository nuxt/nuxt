import http from 'http'
import { existsSync } from 'fs'
import { resolve } from 'path'
import serveStatic from 'serve-static'
import finalhandler from 'finalhandler'
import rp from 'request-promise-native'
import { Nuxt, Generator, Options } from '..'
import { loadFixture, getPort } from './utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null
let server = null
let generator = null

describe('fallback generate', () => {
  beforeAll(async () => {
    const config = loadFixture('basic')

    nuxt = new Nuxt(config)
    generator = new Generator(nuxt)

    await generator.generate({ build: false })

    const serve = serveStatic(resolve(__dirname, 'fixtures/basic/dist'))
    server = http.createServer((req, res) => {
      serve(req, res, finalhandler(req, res))
    })

    port = await getPort()

    server.listen(port)
  })

  test('default creates /200.html as fallback', async () => {
    const html = await rp(url('/200.html'))
    expect(html.includes('<h1>Index page</h1>')).toBe(false)
    expect(html.includes('data-server-rendered')).toBe(false)
    expect(existsSync(resolve(__dirname, 'fixtures/basic/dist', '200.html'))).toBe(true)
    expect(existsSync(resolve(__dirname, 'fixtures/basic/dist', '404.html'))).toBe(false)
  })

  test('nuxt re-generating with generate.fallback = false', async () => {
    // const logSpy = await interceptLog(async () => {
    nuxt.options.generate.fallback = false
    await generator.generate({ build: false })
    // expect(logSpy.calledWithMatch('DONE')).toBe(true)
  })

  test('false creates no fallback', async () => {
    await expect(rp(url('/200.html'))).rejects.toMatchObject({
      statusCode: 404,
      response: {
        body: expect.stringContaining('Cannot GET /200.html')
      }
    })

    expect(existsSync(resolve(__dirname, 'fixtures/basic/dist', '200.html'))).toBe(false)
    expect(existsSync(resolve(__dirname, 'fixtures/basic/dist', '404.html'))).toBe(false)
  })

  test('generate.fallback = true is transformed to /404.html', async () => {
    nuxt.options.generate.fallback = true
    const options = Options.from(nuxt.options)
    expect(options.generate.fallback).toBe('404.html')
  })

  test(
    'nuxt re-generating with generate.fallback = "spa-fallback.html"',
    async () => {
      nuxt.options.generate.fallback = 'spa-fallback.html'
      await generator.generate({ build: false })
    }
  )

  // Close server and ask nuxt to stop listening to file changes
  test('Closing server', async () => {
    await server.close()
  })
})
