import { resolve } from 'path'

import express from 'express'
import rp from 'request-promise-native'

import { Nuxt, Builder } from '..'

const port = 4000
const url = route => 'http://localhost:' + port + route

let nuxt
let app

describe('express', () => {
  // Init nuxt.js and create express server
  beforeAll(async () => {
    const config = {
      rootDir: resolve(__dirname, 'fixtures/basic'),
      buildDir: '.nuxt-express',
      dev: false,
      build: {
        stats: false
      }
    }

    nuxt = new Nuxt(config)
    new Builder(nuxt).build()

    // Create express app
    app = express()

    // Register nuxt
    app.use(nuxt.render)

    // Start listening on localhost:4000
    app.listen(port)
  }, 30000)

  test('/stateless with express', async () => {
    const html = await rp(url('/stateless'))

    expect(html.includes('<h1>My component!</h1>')).toBe(true)
  })
})
