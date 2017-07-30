import test from 'ava'
import { resolve } from 'path'
import { Nuxt, Builder } from '../index.js'
import express from 'express'
import rp from 'request-promise-native'

const port = 4000
const url = (route) => 'http://localhost:' + port + route

let nuxt
let app

// Init nuxt.js and create express server
test.before('Init Nuxt.js', async t => {
  const options = {
    rootDir: resolve(__dirname, 'fixtures/basic'),
    dev: false
  }

  // Create nuxt instace
  nuxt = new Nuxt(options)

  // Build
  await new Builder(nuxt).build()

  // Create express app
  app = express()

  // Register nuxt
  app.use(nuxt.render)

  // Start listening on localhost:4000
  app.listen(port)
})

test('/stateless with express', async t => {
  const html = await rp(url('/stateless'))

  t.true(html.includes('<h1>My component!</h1>'))
})
