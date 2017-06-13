import test from 'ava'
import { resolve } from 'path'

const Nuxt = require('../')

test('Nuxt.js Class', t => {
  t.is(typeof Nuxt, 'function')
})

test.serial('Nuxt.js Instance', async t => {
  const nuxt = new Nuxt({
    dev: false,
    rootDir: resolve(__dirname, 'fixtures', 'empty')
  })
  t.is(typeof nuxt, 'object')
  t.is(nuxt.options.dev, false)
  t.is(typeof nuxt.build, 'function')
  t.is(typeof nuxt.generate, 'function')
  t.is(typeof nuxt._init.then, 'function')
  await nuxt.init()
  t.is(nuxt.initialized, true)
})

test.serial('Fail to build when no pages/ directory but is in the parent', async t => {
  const nuxt = new Nuxt({
    dev: true,
    rootDir: resolve(__dirname, 'fixtures', 'empty', 'pages')
  })
  return new Promise((resolve) => {
    let oldExit = process.exit
    let oldCE = console.error // eslint-disable-line no-console
    let _log = ''
    console.error = (s) => { _log += s } // eslint-disable-line no-console
    process.exit = (code) => {
      process.exit = oldExit
      console.error = oldCE // eslint-disable-line no-console
      t.is(code, 1)
      t.true(_log.includes('No `pages` directory found. Did you mean to run `nuxt` in the parent (`../`) directory?'))
      resolve()
    }
    nuxt.build()
  })
})

test.serial('Fail to build when no pages/ directory', async t => {
  const nuxt = new Nuxt({
    dev: true,
    rootDir: resolve(__dirname)
  })
  return new Promise((resolve) => {
    let oldExit = process.exit
    let oldCE = console.error // eslint-disable-line no-console
    let _log = ''
    console.error = (s) => { _log += s } // eslint-disable-line no-console
    process.exit = (code) => {
      process.exit = oldExit
      console.error = oldCE // eslint-disable-line no-console
      t.is(code, 1)
      t.true(_log.includes('Couldn\'t find a `pages` directory. Please create one under the project root'))
      resolve()
    }
    nuxt.build()
  })
})
