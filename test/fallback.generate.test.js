import test from 'ava'
import { resolve } from 'path'
import { existsSync } from 'fs'
import http from 'http'
import serveStatic from 'serve-static'
import finalhandler from 'finalhandler'
import rp from 'request-promise-native'
import { intercept, interceptLog } from './helpers/console'
import { Nuxt, Builder, Generator, Options } from '..'
import { loadConfig } from './helpers/config'

const port = 4015
const url = route => 'http://localhost:' + port + route

let nuxt = null
let server = null
let generator = null

// Init nuxt.js and create server listening on localhost:4015
test.serial('Init Nuxt.js', async t => {
  let config = loadConfig('basic', {
    buildDir: '.nuxt-spa-fallback',
    dev: false
  })
  config.build.stats = false

  const logSpy = await interceptLog(async () => {
    nuxt = new Nuxt(config)
    const builder = new Builder(nuxt)
    generator = new Generator(nuxt, builder)

    await generator.generate()
  })
  t.true(logSpy.calledWithMatch('DONE'))

  const serve = serveStatic(resolve(__dirname, 'fixtures/basic/dist'))
  server = http.createServer((req, res) => {
    serve(req, res, finalhandler(req, res))
  })
  server.listen(port)
})

test.serial('default creates /200.html as fallback', async t => {
  const html = await rp(url('/200.html'))
  t.false(html.includes('<h1>Index page</h1>'))
  t.false(html.includes('data-server-rendered'))
  t.true(existsSync(resolve(__dirname, 'fixtures/basic/dist', '200.html')))
  t.false(existsSync(resolve(__dirname, 'fixtures/basic/dist', '404.html')))
})

test.serial('nuxt re-generating with generate.fallback = false', async t => {
  const logSpy = await interceptLog(async () => {
    nuxt.options.generate.fallback = false
    await generator.generate()
  })
  t.true(logSpy.calledWithMatch('DONE'))
})

test.serial('false creates no fallback', async t => {
  const error = await t.throws(rp(url('/200.html')))
  t.true(error.statusCode === 404)
  t.true(error.response.body.includes('Cannot GET /200.html'))
  t.false(existsSync(resolve(__dirname, 'fixtures/basic/dist', '200.html')))
  t.false(existsSync(resolve(__dirname, 'fixtures/basic/dist', '404.html')))
})

test.serial('generate.fallback = true is transformed to /404.html', async t => {
  nuxt.options.generate.fallback = true
  const options = Options.from(nuxt.options)
  t.is(options.generate.fallback, '404.html')
})

test.serial('nuxt re-generating with generate.fallback = "spa-fallback.html"', async t => {
  const logSpy = await interceptLog(async () => {
    nuxt.options.generate.fallback = 'spa-fallback.html'
    await generator.generate()
  })
  t.true(logSpy.calledWithMatch('DONE'))
})

test.serial('"spa-fallback.html" creates /spa-fallback.html as fallback', async t => {
  const html = await rp(url('/spa-fallback.html'))
  t.false(html.includes('<h1>Index page</h1>'))
  t.false(html.includes('data-server-rendered'))
  t.true(
    existsSync(resolve(__dirname, 'fixtures/basic/dist', 'spa-fallback.html'))
  )
  t.false(existsSync(resolve(__dirname, 'fixtures/basic/dist', '404.html')))
  t.false(existsSync(resolve(__dirname, 'fixtures/basic/dist', '200.html')))
})

test.serial('nuxt re-generating with generate.fallback = "index.html"', async t => {
  const {log: logSpy, warn: warnSpy} = await intercept({warn: true, log: true}, async () => {
    nuxt.options.generate.fallback = 'index.html'
    await generator.generate()
  })
  t.true(warnSpy.calledWithMatch('WARN')) // Must emit warnning
  t.true(logSpy.calledWithMatch('DONE'))
})

test.serial('"index.html" creates /index.html as fallback', async t => {
  const html = await rp(url('/index.html'))
  t.true(html.includes('<h1>Index page</h1>'))
  t.true(html.includes('data-server-rendered'))
  t.true(existsSync(resolve(__dirname, 'fixtures/basic/dist', 'index.html')))
  t.false(existsSync(resolve(__dirname, 'fixtures/basic/dist', '404.html')))
  t.false(existsSync(resolve(__dirname, 'fixtures/basic/dist', '200.html')))
})

// Close server and ask nuxt to stop listening to file changes
test.after.always('Closing server', async t => {
  await server.close()
})
