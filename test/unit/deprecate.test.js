import { loadFixture, getPort, Nuxt } from '../utils'

let port

let nuxt = null
// let buildSpies = null

describe('deprecate', () => {
  beforeAll(async () => {
    const config = loadFixture('deprecate')

    nuxt = new Nuxt(config)
    port = await getPort()
    await nuxt.listen(port, 'localhost')
  })

  test.skip('Deprecated: module.addVendor()', async () => {
    // expect(
    //   buildSpies.warn.calledWithMatch('module: addVendor is no longer necessary')
    // ).toBe(true)
  })

  // Close server and ask nuxt to stop listening to file changes
  test('Closing server and nuxt.js', async () => {
    await nuxt.close()
  })
})
