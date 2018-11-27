import consola from 'consola'
import { loadFixture, getPort, Nuxt } from '../utils'

let port = null
let nuxt = null

describe('server listen', () => {
  beforeAll(async () => {
    const config = await loadFixture('empty')
    nuxt = new Nuxt(config)
    port = await getPort()
  })

  test('should listen different ports', async () => {
    await nuxt.server.listen(port, 'localhost')
    await nuxt.server.listen(port, 'localhost')

    expect(nuxt.server.listeners[0].port).toBe(port)
    expect(nuxt.server.listeners[1].port).not.toBe(nuxt.server.listeners[0].port)

    expect(consola.warn).toHaveBeenCalledTimes(1)
    expect(consola.warn).toHaveBeenCalledWith(`Address \`localhost:${port}\` is already in use.`)
  })

  afterAll(async () => {
    await nuxt.close()
  })
})
