import { existsSync, writeFileSync } from 'fs'
import http from 'http'
import { resolve } from 'path'
import { remove } from 'fs-extra'
import serveStatic from 'serve-static'
import finalhandler from 'finalhandler'
import { TARGETS } from '@nuxt/utils'
import { Builder, Generator, getPort, loadFixture, Nuxt, rp, listPaths, equalOrStartsWith } from '../utils'

let port
const url = route => 'http://localhost:' + port + route
const rootDir = resolve(__dirname, '..', 'fixtures/basic')
const distDir = resolve(rootDir, '.nuxt-generate')

let builder
let server = null
let generator = null
let pathsBefore
let changedFileName

describe('basic generate', () => {
  beforeAll(async () => {
    const config = await loadFixture('basic', {
      generate: {
        static: false,
        dir: '.nuxt-generate'
      }
    })
    const nuxt = new Nuxt(config)
    await nuxt.ready()

    pathsBefore = listPaths(nuxt.options.rootDir)

    // Make sure our check for changed files is really working
    changedFileName = resolve(nuxt.options.generate.dir, '..', '.nuxt-generate', '.nuxt-generate-changed')
    nuxt.hook('generate:done', () => {
      writeFileSync(changedFileName, '')
    })
    nuxt.hook('export:page', ({ page, errors }) => {
      if (errors.length && page.route.includes('/skip-on-fail')) {
        page.exclude = true
      }
    })

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

  test('Check builder', () => {
    expect(builder.bundleBuilder.buildContext.target).toBe(TARGETS.static)
    expect(builder.build).toHaveBeenCalledTimes(1)
  })

  test('Check ready hook called', () => {
    expect(generator.nuxt.__hook_ready_called__).toBe(true)
  })

  test('Check changed files', () => {
    // When generating Nuxt we only expect files to change
    // within nuxt.options.generate.dir, but also allow other
    // .nuxt dirs for when tests are runInBand
    const allowChangesDir = resolve(generator.nuxt.options.generate.dir, '..', '.nuxt')

    let changedFileFound = false
    const paths = listPaths(generator.nuxt.options.rootDir, pathsBefore)
    paths.forEach((item) => {
      if (item.path === changedFileName) {
        changedFileFound = true
      } else {
        expect(equalOrStartsWith(allowChangesDir, item.path)).toBe(true)
      }
    })
    expect(changedFileFound).toBe(true)
  })

  test('Format errors', () => {
    const error = generator._formatErrors([
      { type: 'handled', route: '/h1', error: 'page not found' },
      { type: 'unhandled', route: '/h2', error: { stack: 'unhandled error stack' } }
    ])
    expect(error).toMatch(' /h1')
    expect(error).toMatch(' /h2')
    expect(error).toMatch('"page not found"')
    expect(error).toMatch('unhandled error stack')
  })

  test('/stateless', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/stateless'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<h1>My component!</h1>')
  })

  test('/store-module', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/store-module'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<h1>mutated</h1>')
  })

  test('/css', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/css'))

    const headHtml = window.document.head.innerHTML
    expect(headHtml).toContain('.red{color:red')

    const element = window.document.querySelector('.red')
    expect(element).not.toBe(null)
    expect(element.textContent).toContain('This is red')
    expect(element.className).toBe('red')
    // t.is(window.getComputedStyle(element), 'red')
  })

  test('/stateful', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/stateful'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<div><p>The answer is 42</p></div>')
  })

  test('/head', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/head'))
    const html = window.document.body.innerHTML
    const metas = window.document.getElementsByTagName('meta')
    expect(window.document.title).toBe('My title - Nuxt.js')
    expect(metas[0].getAttribute('data-n-head')).toBe('ssr')
    expect(metas[1].getAttribute('content')).toBe('my meta')
    expect(html).toContain('<div><h1>I can haz meta tags</h1></div>')
  })

  test('/async-data', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/async-data'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<p>Nuxt.js</p>')
  })

  test('/тест雨 (test non ascii route)', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/тест雨'))
    const html = window.document.body.innerHTML
    expect(html).toContain('Hello unicode')
  })

  test('/users/1/index.html', async () => {
    const { body: html } = await rp(url('/users/1/index.html'))
    expect(html).toContain('<h1>User: 1</h1>')
    expect(
      existsSync(resolve(distDir, 'users/1/index.html'))
    ).toBe(true)
    expect(existsSync(resolve(distDir, 'users/1.html'))).toBe(false)
  })

  test('/users/2', async () => {
    const { body: html } = await rp(url('/users/2'))
    expect(html).toContain('<h1>User: 2</h1>')
  })

  test('/users/3 (payload given)', async () => {
    const { body: html } = await rp(url('/users/3'))
    expect(html).toContain('<h1>User: 3000</h1>')
  })

  test('/users/4 -> Not found', async () => {
    await expect(rp(url('/users/4'))).rejects.toMatchObject({
      response: {
        statusCode: 404,
        body: expect.stringContaining('Cannot GET /users/4')
      }
    })
  })

  test('/validate should not be server-rendered', async () => {
    const { body: html } = await rp(url('/validate'))
    expect(html).toContain('<div id="__nuxt"></div>')
  })

  test.posix('/validate -> should display a 404', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/validate'))
    const html = window.document.body.innerHTML
    expect(html).toContain('This page could not be found')
  })

  test('/validate?valid=true', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/validate?valid=true'))
    const html = window.document.body.innerHTML
    expect(html).toContain('I am valid</h1>')
  })

  test('/redirect should not be server-rendered', async () => {
    const { body: html } = await rp(url('/redirect'))
    expect(html).toContain('<div id="__nuxt"></div>')

    // vue-meta should also not indicate ssr
    expect(html).toContain('<html>')
    expect(html).toContain('<meta data-n-head="1" charset="utf-8">')
  })

  test('/redirect -> check redirected source', async () => {
    const window = await generator.nuxt.server.renderAndGetWindow(url('/redirect'))
    const html = window.document.body.innerHTML
    expect(html).toContain('<h1>Index page</h1>')
  })

  test('/users/1 not found', async () => {
    await remove(resolve(distDir, 'users'))
    await expect(rp(url('/users/1'))).rejects.toMatchObject({
      response: {
        statusCode: 404,
        body: expect.stringContaining('Cannot GET /users/1')
      }
    })
  })

  test('nuxt re-generating with no subfolders', async () => {
    generator.nuxt.options.generate.subFolders = false
    generator.getAppRoutes = jest.fn(() => [])
    await expect(generator.generate()).resolves.toBeTruthy()
  })

  test('/users/1.html', async () => {
    const { body } = await rp(url('/users/1.html'))
    expect(body).toContain('<h1>User: 1</h1>')
    expect(existsSync(resolve(distDir, 'users/1.html'))).toBe(true)
    expect(
      existsSync(resolve(distDir, 'users/1/index.html'))
    ).toBe(false)
  })

  test('/-ignored', async () => {
    await expect(rp(url('/-ignored'))).rejects.toMatchObject({
      response: {
        statusCode: 404,
        body: expect.stringContaining('Cannot GET /-ignored')
      }
    })
  })

  test('/ignored.test', async () => {
    await expect(rp(url('/ignored.test'))).rejects.toMatchObject({
      response: {
        statusCode: 404,
        body: expect.stringContaining('Cannot GET /ignored.test')
      }
    })
  })

  test('creates /200.html as fallback', async () => {
    const { body: html } = await rp(url('/200.html'))
    expect(html.includes('<h1>Index page</h1>')).toBe(false)
    expect(html.includes('data-server-rendered')).toBe(false)
    expect(existsSync(resolve(distDir, '200.html'))).toBe(true)
    expect(existsSync(resolve(distDir, '404.html'))).toBe(false)
  })

  test('Checke skipped files', () => {
    expect(
      existsSync(resolve(distDir, 'skip-on-fail/fail.html'))
    ).toBe(false)

    expect(
      existsSync(resolve(distDir, 'skip-on-fail/success.html'))
    ).toBe(true)
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await server.close()
  })
})
