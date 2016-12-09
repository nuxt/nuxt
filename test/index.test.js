import test from 'ava'
import { resolve } from 'path'

const Nuxt = require('../')

test('Nuxt.js Class', t => {
  t.is(typeof Nuxt, 'function')
})

test('Nuxt.js Instance', t => {
  const nuxt = new Nuxt()
  t.is(typeof nuxt, 'object')
  t.is(nuxt.dev, true)
  t.is(typeof nuxt.build, 'function')
  t.is(typeof nuxt.generate, 'function')
})

test('Fail when build not done and try to render', async t => {
  const nuxt = new Nuxt({
    dev: false,
    rootDir: resolve(__dirname, 'empty')
  })
  return new Promise((resolve) => {
    var oldExit = process.exit
    var oldCE = console.error // eslint-disable-line no-console
    var _log = ''
    console.error = (s) => { _log += s } // eslint-disable-line no-console
    process.exit = (code) => {
      process.exit = oldExit
      console.error = oldCE // eslint-disable-line no-console
      t.is(code, 1)
      t.true(_log.includes('No build files found'))
      resolve()
    }
    nuxt.render()
  })
})
