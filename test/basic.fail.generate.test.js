import test from 'ava'
import { resolve } from 'path'

test('Fail with routes() which throw an error', async t => {
  const Nuxt = require('../')
  const options = {
    rootDir: resolve(__dirname, 'fixtures/basic'),
    dev: false,
    generate: {
      routes: function () {
        return new Promise((resolve, reject) => {
          reject(new Error('Not today!'))
        })
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
      t.true(_log.includes('Could not resolve routes'))
      resolve()
    }
    nuxt.generate()
    .catch((e) => {
      t.true(e.message === 'Not today!')
    })
  })
})
