import test from 'ava'
import { resolve } from 'path'

test('Fail to generate without routeParams', t => {
  const Nuxt = require('../')
  const options = {
    rootDir: resolve(__dirname, 'fixtures/basic'),
    dev: false
    // no generate.routeParams
  }
  const nuxt = new Nuxt(options)
  return new Promise((resolve) => {
    var oldExit = process.exit
    var oldCE = console.error // eslint-disable-line no-console
    var _log = ''
    console.error = (s) => { _log += s } // eslint-disable-line no-console
    process.exit = (code) => {
      process.exit = oldExit
      console.error = oldCE // eslint-disable-line no-console
      t.is(code, 1)
      t.true(_log.includes('Could not generate the dynamic route /users/:id'))
      resolve()
    }
    nuxt.generate()
  })
})

test('Fail with routeParams which throw an error', t => {
  const Nuxt = require('../')
  const options = {
    rootDir: resolve(__dirname, 'fixtures/basic'),
    dev: false,
    generate: {
      routeParams: {
        '/users/:id': function () {
          return new Promise((resolve, reject) => {
            reject('Not today!')
          })
        }
      }
    }
  }
  const nuxt = new Nuxt(options)
  return new Promise((resolve) => {
    var oldExit = process.exit
    var oldCE = console.error // eslint-disable-line no-console
    var _log = ''
    console.error = (s) => { _log += s } // eslint-disable-line no-console
    process.exit = (code) => {
      process.exit = oldExit
      console.error = oldCE // eslint-disable-line no-console
      t.is(code, 1)
      t.true(_log.includes('Could not resolve routeParams[/users/:id]'))
      resolve()
    }
    nuxt.generate()
    .catch((e) => {
      t.true(e === 'Not today!')
    })
  })
})
