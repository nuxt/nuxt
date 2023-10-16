import express from 'express'
import { loadFixture, getPort, Nuxt, rp } from '../utils'

let port
const url = route => 'http://127.0.0.1:' + port + route

let nuxt
let app
let server

describe('express', () => {
  // Init nuxt and create express server
  beforeAll(async () => {
    const config = await loadFixture('basic')
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()

    // Create express app
    app = express()

    // Register nuxt
    app.use(nuxt.render)

    // Start listening on localhost:4000
    server = app.listen(port)
  })

  test('/stateless with express', async () => {
    const { body: html } = await rp(url('/stateless'))

    expect(html).toContain('<h1>My component!</h1>')
  })

  afterAll(async () => {
    await nuxt.close()
    await new Promise((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve())
    })
  })
})
