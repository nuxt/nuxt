import { normalize } from 'path'

import test from 'ava'
import rp from 'request-promise-native'

import { Nuxt, Builder } from '..'

import { intercept } from './helpers/console'
import { loadConfig } from './helpers/config'

const port = 4006
const url = route => 'http://localhost:' + port + route

let nuxt = null
let builder = null
let buildSpies = null

// Init nuxt.js and create server listening on localhost:4000
test.serial('Init Nuxt.js', async t => {
  const config = loadConfig('module', { dev: false })

  nuxt = new Nuxt(config)
  builder = new Builder(nuxt)

  buildSpies = await intercept({ log: true, error: true }, async () => {
    await builder.build()
    await nuxt.listen(port, 'localhost')
  })

  t.true(buildSpies.log.calledWithMatch('DONE'))
  t.true(buildSpies.log.calledWithMatch('OPEN'))
})

test.serial('Plugin', async t => {
  t.true(
    normalize(nuxt.options.plugins[0].src).includes(
      normalize('fixtures/module/.nuxt/basic.reverse.')
    ),
    'plugin added to config'
  )
  const { html } = await nuxt.renderRoute('/')
  t.true(html.includes('<h1>TXUN</h1>'), 'plugin works')
})

test.serial('Layout', async t => {
  t.true(
    nuxt.options.layouts.layout.includes('layout'),
    'layout added to config'
  )

  const { html } = await nuxt.renderRoute('/layout')
  t.true(html.includes('<h1>Module Layouts</h1>'), 'layout works')
})

test.serial('Hooks', async t => {
  t.is(nuxt.__module_hook, 1)
  t.is(nuxt.__renderer_hook, 2)
  t.is(nuxt.__builder_hook, 3)
})

test.serial('Hooks - Functional', async t => {
  t.true(nuxt.__ready_called__)
  t.true(builder.__build_done__)
})

test.serial('Hooks - Error', async t => {
  t.true(buildSpies.error.calledWithMatch(/build:extendRoutes/))
})

test('Middleware', async t => {
  let response = await rp(url('/api'))
  t.is(response, 'It works!', '/api response is correct')
})

test('Hooks - Use external middleware before render', async t => {
  let response = await rp(url('/use-middleware'))
  t.is(response, 'Use external middleware')
})

// Close server and ask nuxt to stop listening to file changes
test.after.always('Closing server and nuxt.js', async t => {
  await nuxt.close()
})
