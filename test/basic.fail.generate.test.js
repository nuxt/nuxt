import test from 'ava'
import { resolve } from 'path'
import { Nuxt, Builder, Generator } from '../index.js'

test('Fail with routes() which throw an error', async t => {
  const options = {
    rootDir: resolve(__dirname, 'fixtures/basic'),
    dev: false,
    generate: {
      async routes() {
        throw new Error('Not today!')
      }
    }
  }
  const nuxt = new Nuxt(options)
  const builder = new Builder(nuxt)
  const generator = new Generator(nuxt, builder)
  return generator.generate()
    .catch((e) => {
      t.true(e.message === 'Not today!')
    })
})
