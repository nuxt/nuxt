import consola from 'consola'

import { loadFixture, getPort, Nuxt } from '../utils'

let config

describe('server listen', () => {
  beforeAll(async () => {
    config = await loadFixture('empty')
  })

  test('should throw error when listening on same port (prod)', async () => {
    const nuxt = new Nuxt(config)
    const port = await getPort()
    const listen = () => nuxt.server.listen(port, 'localhost')

    // Listen for first time
    await listen()
    expect(nuxt.server.listeners[0].port).toBe(port)

    // Listen for second time
    await expect(listen()).rejects.toThrow(`Address \`localhost:${port}\` is already in use.`)

    await nuxt.close()
  })

  test('should assign a random port when listening on same port (dev)', async () => {
    const nuxt = new Nuxt({ ...config, dev: true })
    const port = await getPort()
    const listen = () => nuxt.server.listen(port, 'localhost')

    // Listen for first time
    await listen()
    expect(nuxt.server.listeners[0].port).toBe(port)

    // Listen for second time
    await listen()
    expect(nuxt.server.listeners[1].port).not.toBe(nuxt.server.listeners[0].port)
    expect(consola.warn).toHaveBeenCalledTimes(1)
    expect(consola.warn).toHaveBeenCalledWith(`Address \`localhost:${port}\` is already in use.`)

    await nuxt.close()
  })
})
