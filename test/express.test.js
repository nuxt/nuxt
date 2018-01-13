import test from 'ava'
import { resolve } from 'path'
import { Nuxt, Builder } from '..'
import express from 'express'
import rp from 'request-promise-native'
import { interceptLog } from './helpers/console'

const port = 4000
const url = route => 'http://localhost:' + port + route

let nuxt
let app

// Init nuxt.js and create express server
test.serial('Init Nuxt.js', async t => {
  const config = {
    rootDir: resolve(__dirname, 'fixtures/basic'),
    buildDir: '.nuxt-express',
    dev: false,
    build: {
      stats: false
    }
  }

  const logSpy = await interceptLog(async () => {
    nuxt = new Nuxt(config)
    await new Builder(nuxt).build()
  })
  t.true(logSpy.calledWithMatch('DONE'))

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
