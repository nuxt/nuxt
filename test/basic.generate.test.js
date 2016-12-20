import test from 'ava'
import { resolve } from 'path'
import pify from 'pify'
import fs from 'fs'
const readFile = pify(fs.readFile)

let nuxt = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  const Nuxt = require('../')
  const options = {
    rootDir: resolve(__dirname, 'fixtures/basic'),
    dev: false
  }
  nuxt = new Nuxt(options)
  await nuxt.generate()
})

test('/stateless', async t => {
  const html = await readFile(resolve(__dirname, 'fixtures/basic/dist/stateless/index.html'), 'utf8')
  t.true(html.includes('<h1>My component!</h1>'))
})
