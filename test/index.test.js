import test from 'ava'
import { resolve } from 'path'

const Nuxt = require('../')

test('Nuxt.js Class', t => {
  t.is(typeof Nuxt, 'function')
})

test('Nuxt.js Instance', async t => {
  const nuxt = await new Nuxt()
  t.is(typeof nuxt, 'object')
  t.is(nuxt.dev, true)
  t.is(typeof nuxt.build, 'function')
  t.is(typeof nuxt.generate, 'function')
})

test.serial('Fail when build not done and try to render', async t => {
  const nuxt = await new Nuxt({
    dev: false,
    rootDir: resolve(__dirname, 'fixtures/empty')
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
      t.true(_log.includes('No build files found, please run `nuxt build` before launching `nuxt start`'))
      resolve()
    }
    nuxt.render()
  })
})

test.serial('Fail to build when no pages/ directory but is in the parent', async t => {
  const nuxt = await new Nuxt({
    dev: false,
    rootDir: resolve(__dirname, 'fixtures', 'empty', 'pages')
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
      t.true(_log.includes('No `pages` directory found. Did you mean to run `nuxt` in the parent (`../`) directory?'))
      resolve()
    }
    nuxt.build()
  })
})

test.serial('Fail to build when no pages/ directory', async t => {
  const nuxt = await new Nuxt({
    dev: false,
    rootDir: resolve(__dirname)
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
      t.true(_log.includes('Couldn\'t find a `pages` directory. Please create one under the project root'))
      resolve()
    }
    nuxt.build()
  })
})
