import { existsSync } from 'fs'
import http from 'http'
import { resolve } from 'path'

import test from 'ava'
import { remove } from 'fs-extra'
import serveStatic from 'serve-static'
import finalhandler from 'finalhandler'
import rp from 'request-promise-native'

import { Nuxt, Builder, Generator } from '..'

import { interceptLog, release } from './helpers/console'
import { loadConfig } from './helpers/config'

const port = 4002
const url = route => 'http://localhost:' + port + route
const rootDir = resolve(__dirname, 'fixtures/basic')

let nuxt = null
let server = null
let generator = null

// Init nuxt.js and create server listening on localhost:4000
test.serial('Init Nuxt.js', async t => {
  const config = loadConfig('basic', {
    buildDir: '.nuxt-generate',
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

test.serial('Check ready hook called', async t => {
  t.true(nuxt.__hook_called__)
})

test.serial('/stateless', async t => {
  const window = await nuxt.renderAndGetWindow(url('/stateless'))
  const html = window.document.body.innerHTML
  t.true(html.includes('<h1>My component!</h1>'))
})

test.serial('/css', async t => {
  const window = await nuxt.renderAndGetWindow(url('/css'))

  const headHtml = window.document.head.innerHTML
  t.true(headHtml.includes('.red{color:red}'))

  const element = window.document.querySelector('.red')
  t.not(element, null)
  t.is(element.textContent, 'This is red')
  t.is(element.className, 'red')
  // t.is(window.getComputedStyle(element), 'red')
})

test.serial('/stateful', async t => {
  const window = await nuxt.renderAndGetWindow(url('/stateful'))
  const html = window.document.body.innerHTML
  t.true(html.includes('<div><p>The answer is 42</p></div>'))
})

test.serial('/head', async t => {
  const logSpy = await interceptLog()
  const window = await nuxt.renderAndGetWindow(url('/head'))
  const html = window.document.body.innerHTML
  const metas = window.document.getElementsByTagName('meta')
  t.is(window.document.title, 'My title')
  t.is(metas[0].getAttribute('content'), 'my meta')
  t.true(html.includes('<div><h1>I can haz meta tags</h1></div>'))
  release()
  t.is(logSpy.getCall(0).args[0], 'Body script!')
})

test.serial('/async-data', async t => {
  const window = await nuxt.renderAndGetWindow(url('/async-data'))
  const html = window.document.body.innerHTML
  t.true(html.includes('<p>Nuxt.js</p>'))
})

test.serial('/users/1/index.html', async t => {
  const html = await rp(url('/users/1/index.html'))
  t.true(html.includes('<h1>User: 1</h1>'))
  t.true(
    existsSync(resolve(__dirname, 'fixtures/basic/dist', 'users/1/index.html'))
  )
  t.false(existsSync(resolve(__dirname, 'fixtures/basic/dist', 'users/1.html')))
})

test.serial('/users/2', async t => {
  const html = await rp(url('/users/2'))
  t.true(html.includes('<h1>User: 2</h1>'))
})

test.serial('/users/3 (payload given)', async t => {
  const html = await rp(url('/users/3'))
  t.true(html.includes('<h1>User: 3000</h1>'))
})

test.serial('/users/4 -> Not found', async t => {
  const error = await t.throws(rp(url('/users/4')))
  t.true(error.statusCode === 404)
  t.true(error.response.body.includes('Cannot GET /users/4'))
})

test.serial('/validate should not be server-rendered', async t => {
  const html = await rp(url('/validate'))
  t.true(html.includes('<div id="__nuxt"></div>'))
  t.true(html.includes('serverRendered:!1'))
})

test.serial('/validate -> should display a 404', async t => {
  const window = await nuxt.renderAndGetWindow(url('/validate'))
  const html = window.document.body.innerHTML
  t.true(html.includes('This page could not be found'))
})

test.serial('/validate?valid=true', async t => {
  const window = await nuxt.renderAndGetWindow(url('/validate?valid=true'))
  const html = window.document.body.innerHTML
  t.true(html.includes('I am valid</h1>'))
})

test.serial('/redirect should not be server-rendered', async t => {
  const html = await rp(url('/redirect'))
  t.true(html.includes('<div id="__nuxt"></div>'))
  t.true(html.includes('serverRendered:!1'))
})

test.serial('/redirect -> check redirected source', async t => {
  const window = await nuxt.renderAndGetWindow(url('/redirect'))
  const html = window.document.body.innerHTML
  t.true(html.includes('<h1>Index page</h1>'))
})

test.serial('/users/1 not found', async t => {
  await remove(resolve(rootDir, 'dist/users'))
  const error = await t.throws(rp(url('/users/1')))
  t.true(error.statusCode === 404)
  t.true(error.response.body.includes('Cannot GET /users/1'))
})

test.serial('nuxt re-generating with no subfolders', async t => {
  const logSpy = await interceptLog()
  nuxt.options.generate.subFolders = false
  await generator.generate()
  release()
  t.true(logSpy.calledWithMatch('DONE'))
})

test.serial('/users/1.html', async t => {
  const html = await rp(url('/users/1.html'))
  t.true(html.includes('<h1>User: 1</h1>'))
  t.true(existsSync(resolve(__dirname, 'fixtures/basic/dist', 'users/1.html')))
  t.false(
    existsSync(resolve(__dirname, 'fixtures/basic/dist', 'users/1/index.html'))
  )
})

test.serial('/-ignored', async t => {
  const error = await t.throws(rp(url('/-ignored')))
  t.true(error.statusCode === 404)
  t.true(error.response.body.includes('Cannot GET /-ignored'))
})

test.serial('/ignored.test', async t => {
  const error = await t.throws(rp(url('/ignored.test')))
  t.true(error.statusCode === 404)
  t.true(error.response.body.includes('Cannot GET /ignored.test'))
})

// Close server and ask nuxt to stop listening to file changes
test.after.always('Closing server', async t => {
  await server.close()
})
