import test from 'ava'
import { resolve } from 'path'

test('Fail with routes() which throw an error', async t => {
  const Nuxt = require('../')
  const options = {
    rootDir: resolve(__dirname, 'fixtures/basic'),
    dev: false,
    runBuild: true,
    generate: {
      async routes () {
        throw new Error('Not today!')
      }
    }
  }
  const nuxt = new Nuxt(options)
  return nuxt.generate()
    .catch((e) => {
      t.true(e.message === 'Not today!')
    })
})
