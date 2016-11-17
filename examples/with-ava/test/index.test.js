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
test.before('Init nuxt.js', (t) => {
  const Nuxt = require('../../../')
  const options = {
    rootDir: resolve(__dirname, '..'),
    dev: false
  }
  return new Nuxt(options)
  .then(function (_nuxt) {
    nuxt = _nuxt
    server = createServer((req, res) => nuxt.render(req, res))
    return new Promise((resolve, reject) => {
      server.listen(4000, 'localhost', () => {
        resolve()
      })
    })
  })
})

// Function used to do dom checking via jsdom
async function renderAndGetWindow (route) {
  const virtualConsole = jsdom.createVirtualConsole().sendTo(console)
  return new Promise((resolve, reject) => {
    const url = 'http://localhost:4000' + route
    jsdom.env({
      url: url,
      features: {
        FetchExternalResources: ['script', 'link'],
        ProcessExternalResources: ['script']
      },
      virtualConsole,
      done (err, window) {
        if (err) return reject(err)
        // If Nuxt could not be loaded (error from the server-side)
        if (!window.__NUXT__) {
          return reject({
            message: 'Could not load the nuxt app',
            body: window.document.getElementsByTagName('body')[0].innerHTML
          })
        }
        // Used by nuxt.js to say when the components are loaded and the app ready
        window.onNuxtReady = function () {
          resolve(window)
        }
      }
    })
  })
}

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
  const window = await renderAndGetWindow('/')
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
