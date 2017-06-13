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
  await nuxt.build()
  t.is(nuxt.initialized, true)
})

test.serial('Fail to build when no pages/ directory but is in the parent', t => {
  const nuxt = new Nuxt({
    dev: false,
    rootDir: resolve(__dirname, 'fixtures', 'empty', 'pages')
  })
  return nuxt.build().catch(err => {
    let s = String(err)
    t.true(s.includes('No `pages` directory found'))
    t.true(s.includes('Did you mean to run `nuxt` in the parent (`../`) directory?'))
    resolve()
  })
})

test.serial('Fail to build when no pages/ directory', t => {
  const nuxt = new Nuxt({
    dev: false,
    rootDir: resolve(__dirname)
  })
  return nuxt.build().catch(err => {
    let s = String(err)
    t.true(s.includes('Couldn\'t find a `pages` directory'))
    t.true(s.includes('Please create one under the project root'))
    resolve()
  })
})
