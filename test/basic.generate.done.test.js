import test from 'ava'
import { resolve } from 'path'

test('Calls done function', async t => {
  let generateDone = false
  const Nuxt = require('../')
  const options = {
    rootDir: resolve(__dirname, 'fixtures/basic'),
    dev: false,
    generate: {
      done: function () {
        generateDone = true
      }
    }
  }
  const nuxt = new Nuxt(options)
  await nuxt.generate()
  t.is(generateDone, true)
})

test('Calls done function with errors in errorcase', async t => {
  let generateErrors
  const Nuxt = require('../')
  const options = {
    rootDir: resolve(__dirname, 'fixtures/error'),
    dev: false,
    generate: {
      done: function (errors) {
        generateErrors = errors
      }
    }
  }
  const nuxt = new Nuxt(options)
  await nuxt.generate()
  t.is(generateErrors.length, 1)
  t.is(generateErrors[0].type, 'unhandled')
  t.is(generateErrors[0].route, '/')
})
