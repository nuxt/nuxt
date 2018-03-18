import http from 'http'
import { existsSync } from 'fs'
import { resolve } from 'path'

import serveStatic from 'serve-static'
import finalhandler from 'finalhandler'
import rp from 'request-promise-native'

import { Nuxt, Builder, Generator, Options } from '..'

import { loadConfig } from './helpers/config'

const port = 4015
const url = route => 'http://localhost:' + port + route

let nuxt = null
let server = null
let generator = null

describe('fallback generate', () => {
  // Init nuxt.js and create server listening on localhost:4015
  beforeAll(async () => {
    let config = loadConfig('basic', {
      buildDir: '.nuxt-spa-fallback',
      dev: false
    })
    config.build.stats = false

    nuxt = new Nuxt(config)
    const builder = new Builder(nuxt)
    generator = new Generator(nuxt, builder)

    await generator.generate()

    const serve = serveStatic(resolve(__dirname, 'fixtures/basic/dist'))
    server = http.createServer((req, res) => {
      serve(req, res, finalhandler(req, res))
    })
    server.listen(port)
  }, 30000)

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
    await generator.generate()
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
      await generator.generate()
    }
  )

  test(
    '"spa-fallback.html" creates /spa-fallback.html as fallback',
    async () => {
      const html = await rp(url('/spa-fallback.html'))
      expect(html.includes('<h1>Index page</h1>')).toBe(false)
      expect(html.includes('data-server-rendered')).toBe(false)
      expect(existsSync(resolve(__dirname, 'fixtures/basic/dist', 'spa-fallback.html'))).toBe(true)
      expect(existsSync(resolve(__dirname, 'fixtures/basic/dist', '404.html'))).toBe(false)
      expect(existsSync(resolve(__dirname, 'fixtures/basic/dist', '200.html'))).toBe(false)
    }
  )

  test('nuxt re-generating with generate.fallback = "index.html"', async () => {
    nuxt.options.generate.fallback = 'index.html'
    await generator.generate()
  })

  test('"index.html" creates /index.html as fallback', async () => {
    const html = await rp(url('/index.html'))
    expect(html.includes('<h1>Index page</h1>')).toBe(true)
    expect(html.includes('data-server-rendered')).toBe(true)
    expect(existsSync(resolve(__dirname, 'fixtures/basic/dist', 'index.html'))).toBe(true)
    expect(existsSync(resolve(__dirname, 'fixtures/basic/dist', '404.html'))).toBe(false)
    expect(existsSync(resolve(__dirname, 'fixtures/basic/dist', '200.html'))).toBe(false)
  })

  // Close server and ask nuxt to stop listening to file changes
  test('Closing server', async () => {
    await server.close()
  })
})
