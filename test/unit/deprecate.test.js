import { loadFixture, getPort, Nuxt } from '../utils'

let port

let nuxt = null
// let buildSpies = null

describe.skip('deprecate', () => {
  beforeAll(async () => {
    const config = loadFixture('deprecate')

    nuxt = new Nuxt(config)
    port = await getPort()
    await nuxt.listen(port, 'localhost')
  })

  test()

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
