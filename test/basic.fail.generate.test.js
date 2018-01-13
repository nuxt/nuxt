import test from 'ava'
import { resolve } from 'path'
import { Nuxt, Builder, Generator } from '..'
import { intercept } from './helpers/console'

test('Fail with routes() which throw an error', async t => {
  const options = {
    rootDir: resolve(__dirname, 'fixtures/basic'),
    buildDir: '.nuxt-fail',
    dev: false,
    build: {
      stats: false
    },
    generate: {
      async routes() {
        throw new Error('Not today!')
      }
    }
  }
  const spies = await intercept(async () => {
    const nuxt = new Nuxt(options)
    const builder = new Builder(nuxt)
    const generator = new Generator(nuxt, builder)

    return generator.generate().catch(e => {
      t.true(e.message === 'Not today!')
    })
  })
  t.true(spies.log.calledWithMatch('DONE'))
  t.true(spies.error.withArgs('Could not resolve routes').calledOnce)
})
