import { existsSync } from 'fs'
import http from 'http'
import { resolve } from 'path'
import { remove } from 'fs-extra'
import serveStatic from 'serve-static'
import finalhandler from 'finalhandler'
import { loadFixture, getPort, Nuxt, Generator, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route
const rootDir = resolve(__dirname, '..', 'fixtures/basic')
const distDir = resolve(rootDir, '.nuxt-generate')

let nuxt = null
let server = null
let generator = null

describe('basic generate', () => {
  beforeAll(async () => {
    const config = loadFixture('basic', {generate: {dir: '.nuxt-generate'}})
    nuxt = new Nuxt(config)
    generator = new Generator(nuxt)

    await generator.generate({ build: false })

    const serve = serveStatic(distDir)
    server = http.createServer((req, res) => {
      serve(req, res, finalhandler(req, res))
    })

    port = await getPort()
    server.listen(port)
  })

  test('Check ready hook called', async () => {
    expect(nuxt.__hook_called__).toBe(true)
  })

  test('/stateless', async () => {
    const window = await nuxt.renderAndGetWindow(url('/stateless'))
    const html = window.document.body.innerHTML
    expect(html.includes('<h1>My component!</h1>')).toBe(true)
  })

  test('/css', async () => {
    const window = await nuxt.renderAndGetWindow(url('/css'))

    const headHtml = window.document.head.innerHTML
    expect(headHtml.includes('.red{color:red}')).toBe(true)

    const element = window.document.querySelector('.red')
    expect(element).not.toBe(null)
    expect(element.textContent).toBe('This is red')
    expect(element.className).toBe('red')
    // t.is(window.getComputedStyle(element), 'red')
  })

  test('/stateful', async () => {
    const window = await nuxt.renderAndGetWindow(url('/stateful'))
    const html = window.document.body.innerHTML
    expect(html.includes('<div><p>The answer is 42</p></div>')).toBe(true)
  })

  test('/head', async () => {
    // const logSpy = await interceptLog()
    const window = await nuxt.renderAndGetWindow(url('/head'))
    const html = window.document.body.innerHTML
    const metas = window.document.getElementsByTagName('meta')
    expect(window.document.title).toBe('My title - Nuxt.js')
    expect(metas[0].getAttribute('content')).toBe('my meta')
    expect(html.includes('<div><h1>I can haz meta tags</h1></div>')).toBe(true)
    // release()
    // expect(logSpy.getCall(0).args[0]).toBe('Body script!')
  })

  test('/async-data', async () => {
    const window = await nuxt.renderAndGetWindow(url('/async-data'))
    const html = window.document.body.innerHTML
    expect(html.includes('<p>Nuxt.js</p>')).toBe(true)
  })

  test('/users/1/index.html', async () => {
    const html = await rp(url('/users/1/index.html'))
    expect(html.includes('<h1>User: 1</h1>')).toBe(true)
    expect(
      existsSync(resolve(distDir, 'users/1/index.html'))
    ).toBe(true)
    expect(existsSync(resolve(distDir, 'users/1.html'))).toBe(false)
  })

  test('/users/2', async () => {
    const html = await rp(url('/users/2'))
    expect(html.includes('<h1>User: 2</h1>')).toBe(true)
  })

  test('/users/3 (payload given)', async () => {
    const html = await rp(url('/users/3'))
    expect(html.includes('<h1>User: 3000</h1>')).toBe(true)
  })

  test('/users/4 -> Not found', async () => {
    await expect(rp(url('/users/4'))).rejects.toMatchObject({
      statusCode: 404,
      response: {
        body: expect.stringContaining('Cannot GET /users/4')
      }
    })
  })

  test('/validate should not be server-rendered', async () => {
    const html = await rp(url('/validate'))
    expect(html.includes('<div id="__nuxt"></div>')).toBe(true)
    expect(html.includes('serverRendered:!1')).toBe(true)
  })

  test('/validate -> should display a 404', async () => {
    const window = await nuxt.renderAndGetWindow(url('/validate'))
    const html = window.document.body.innerHTML
    expect(html.includes('This page could not be found')).toBe(true)
  })

  test('/validate?valid=true', async () => {
    const window = await nuxt.renderAndGetWindow(url('/validate?valid=true'))
    const html = window.document.body.innerHTML
    expect(html.includes('I am valid</h1>')).toBe(true)
  })

  test('/redirect should not be server-rendered', async () => {
    const html = await rp(url('/redirect'))
    expect(html.includes('<div id="__nuxt"></div>')).toBe(true)
    expect(html.includes('serverRendered:!1')).toBe(true)
  })

  test('/redirect -> check redirected source', async () => {
    const window = await nuxt.renderAndGetWindow(url('/redirect'))
    const html = window.document.body.innerHTML
    expect(html.includes('<h1>Index page</h1>')).toBe(true)
  })

  test('/users/1 not found', async () => {
    await remove(resolve(distDir, 'users'))
    await expect(rp(url('/users/1'))).rejects.toMatchObject({
      statusCode: 404,
      response: {
        body: expect.stringContaining('Cannot GET /users/1')
      }
    })
  })

  test('nuxt re-generating with no subfolders', async () => {
    // const logSpy = await interceptLog()
    nuxt.options.generate.subFolders = false
    await generator.generate({ build: false })
    // release()
    // expect(logSpy.calledWithMatch('DONE')).toBe(true)
  })

  test('/users/1.html', async () => {
    const html = await rp(url('/users/1.html'))
    expect(html.includes('<h1>User: 1</h1>')).toBe(true)
    expect(existsSync(resolve(distDir, 'users/1.html'))).toBe(true)
    expect(
      existsSync(resolve(distDir, 'users/1/index.html'))
    ).toBe(false)
  })

  test('/-ignored', async () => {
    await expect(rp(url('/-ignored'))).rejects.toMatchObject({
      statusCode: 404,
      response: {
        body: expect.stringContaining('Cannot GET /-ignored')
      }
    })
  })

  test('/ignored.test', async () => {
    await expect(rp(url('/ignored.test'))).rejects.toMatchObject({
      statusCode: 404,
      response: {
        body: expect.stringContaining('Cannot GET /ignored.test')
      }
    })
  })

  // Close server and ask nuxt to stop listening to file changes
  test('Closing server', async () => {
    await server.close()
  })
})
