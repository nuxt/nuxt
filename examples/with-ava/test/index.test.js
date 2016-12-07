/*
** Test with Ava can be written in ES6 \o/
*/
import test from 'ava'
import jsdom from 'jsdom'
import { createServer } from 'http'
import { resolve } from 'path'

let nuxt = null
let server = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', (t) => {
  const Nuxt = require('../../../')
  const options = {
    rootDir: resolve(__dirname, '..'),
    dev: false
  }
  nuxt = new Nuxt(options)
  return nuxt.build()
  .then(function () {
    server = createServer((req, res) => nuxt.render(req, res))
    server.listen(4000, 'localhost')
  })
})

/*
** Example of testing only the html
*/
test('Route / exits and render HTML', async t => {
  let context = {}
  const { html } = await nuxt.renderRoute('/', context)
  t.true(html.includes('<p class="red-color">Hello world!</p>'))
  t.is(context.nuxt.error, null)
  t.is(context.nuxt.data[0].name, 'world')
})

/*
** Example of testing via dom checking
*/
test('Route / exits and render HTML', async t => {
  const window = await nuxt.renderAndGetWindow(jsdom, 'http://localhost:4000/')
  const element = window.document.querySelector('.red-color')
  t.not(element, null)
  t.is(element.textContent, 'Hello world!')
  t.is(element.className, 'red-color')
  t.is(window.getComputedStyle(element).color, 'red')
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  server.close()
  nuxt.close()
})
