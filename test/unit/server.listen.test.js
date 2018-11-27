import consola from 'consola'
import { loadFixture, getPort, Nuxt } from '../utils'

let port = null
let nuxt1 = null
let nuxt2 = null

describe('server listen', () => {
  beforeAll(async () => {
    const config = await loadFixture('empty')
    nuxt1 = new Nuxt(config)
    nuxt2 = new Nuxt(config)
    port = await getPort()
  })

  test('should listen different ports', async () => {
    await nuxt1.server.listen(port, 'localhost')
    await nuxt2.server.listen(port, 'localhost')

    const host = nuxt1.server.listeners[0].host
    const port1 = nuxt1.server.listeners[0].port
    const port2 = nuxt2.server.listeners[0].port

    expect(port1).toBe(port)
    expect(port2).not.toBe(port1)

    expect(consola.warn).toHaveBeenCalledTimes(1)
    expect(consola.warn).toHaveBeenCalledWith(`Address \`${host}:${port}\` is already in use.`)
  })

  afterAll(async () => {
    await nuxt1.close()
    await nuxt2.close()
  })
})
