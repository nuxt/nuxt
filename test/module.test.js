import { normalize } from 'path'

import rp from 'request-promise-native'

import { Nuxt, Builder } from '..'

import { loadConfig } from './helpers/config'

const port = 4006
const url = route => 'http://localhost:' + port + route

let nuxt = null
let builder = null
let buildSpies = null

// Init nuxt.js and create server listening on localhost:4000
beforeAll(async () => {
  const config = loadConfig('module', { dev: false })

  nuxt = new Nuxt(config)
  builder = new Builder(nuxt)

  await builder.build()
  await nuxt.listen(port, 'localhost')
}, 30000)

test('Plugin', async () => {
  expect(normalize(nuxt.options.plugins[0].src).includes(
    normalize('fixtures/module/.nuxt/basic.reverse.')
  )).toBe(true)
  const { html } = await nuxt.renderRoute('/')
  expect(html.includes('<h1>TXUN</h1>')).toBe(true)
})

test('Layout', async () => {
  expect(nuxt.options.layouts.layout.includes('layout')).toBe(true)

  const { html } = await nuxt.renderRoute('/layout')
  expect(html.includes('<h1>Module Layouts</h1>')).toBe(true)
})

test('Hooks', async () => {
  expect(nuxt.__module_hook).toBe(1)
  expect(nuxt.__renderer_hook).toBe(2)
  expect(nuxt.__builder_hook).toBe(3)
})

test('Hooks - Functional', async () => {
  expect(nuxt.__ready_called__).toBe(true)
  expect(builder.__build_done__).toBe(true)
})

test('Hooks - Error', async () => {
  expect(buildSpies.error.calledWithMatch(/build:extendRoutes/)).toBe(true)
})

test('Middleware', async () => {
  let response = await rp(url('/api'))
  expect(response).toBe('It works!')
})

test('Hooks - Use external middleware before render', async () => {
  let response = await rp(url('/use-middleware'))
  expect(response).toBe('Use external middleware')
})

// Close server and ask nuxt to stop listening to file changes
test('Closing server and nuxt.js', async () => {
  await nuxt.close()
})
