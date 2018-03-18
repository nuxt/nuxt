import { Nuxt, Builder } from '..'
import { loadConfig } from './helpers/config'

const port = 4010

let nuxt = null
let builder = null
// let buildSpies = null

describe('depricate', () => {
  // Init nuxt.js and create server listening on localhost:4000
  beforeAll(async () => {
    const config = loadConfig('deprecate', { dev: false })

    nuxt = new Nuxt(config)
    builder = new Builder(nuxt)
    await builder.build()
    await nuxt.listen(port, 'localhost')
  }, 30000)

  // test('Deprecated: module.addVendor()', async () => {
  //   expect(
  //     buildSpies.warn.calledWithMatch('module: addVendor is no longer necessary')
  //   ).toBe(true)
  // })

  // Close server and ask nuxt to stop listening to file changes
  test('Closing server and nuxt.js', async () => {
    await nuxt.close()
  })
})
