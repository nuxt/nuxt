import test from 'ava'
import { resolve } from 'path'
const port = 4003
// const url = (route) => 'http://localhost:' + port + route

let nuxt = null
let server = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', t => {
  const Nuxt = require('../')
  const options = {
    rootDir: resolve(__dirname, 'children'),
    dev: false
  }
  nuxt = new Nuxt(options)
  return nuxt.build()
  .then(function () {
    server = new nuxt.Server(nuxt)
    server.listen(port, 'localhost')
  })
})

test('/parent', async t => {
  const { html } = await nuxt.renderRoute('/parent')
  t.true(html.includes('<h1>I am the parent</h1>'))
})

test('/parent with _id.vue', async t => {
  // const { html } = await nuxt.renderRoute('/parent')
  // t.true(html.includes('<h1>I am the parent</h1>'))
  // t.true(html.includes('<h2>I am the child</h2>'))
})

test('/parent/child', async t => {
  const { html } = await nuxt.renderRoute('/parent/child')
  t.true(html.includes('<h1>I am the parent</h1>'))
  t.true(html.includes('<h2>I am the child</h2>'))
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  server.close()
  nuxt.close()
})
