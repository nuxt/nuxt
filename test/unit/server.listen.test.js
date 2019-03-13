import consola from 'consola'

import { loadFixture, getPort, Nuxt } from '../utils'

let config

describe('server listen', () => {
  beforeAll(async () => {
    config = await loadFixture('empty')
  })

  test('should throw error when listening on same port (prod)', async () => {
    const nuxt = new Nuxt(config)
    await nuxt.ready()

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
    await nuxt.ready()

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

  test('should skip the use of default port when listening on port 0', async () => {
    // Stub process.env.PORT
    const stubDetails = {
      originalValue: process.env.PORT,
      hasProperty: 'PORT' in process.env
    }
    const DEFAULT_PORT = '2999'
    process.env.PORT = DEFAULT_PORT

    // Setup test
    const nuxt = new Nuxt({ ...config, dev: true })
    await nuxt.ready()

    const listen = () => nuxt.server.listen(0, 'localhost') // Use port 0 to let allow host to randomly assign a free PORT
    const toString = (x = '') => `${x}`

    // Nuxt server should not be listening on the DEFAULT_PORT
    await listen()
    expect(toString(nuxt.server.listeners[0].port)).not.toBe(DEFAULT_PORT)

    // Reset stub for process.env.PORT
    if (stubDetails.hasProperty) {
      process.env.PORT = stubDetails.originalValue
    } else {
      delete process.env.PORT
    }

    // Finalize test
    await nuxt.close()
  })
})
