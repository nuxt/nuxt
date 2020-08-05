// import rp from 'request-promise-native'
import consola from 'consola'
import { loadFixture, getPort, Nuxt } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null
// let logSpy

describe('error', () => {
  beforeAll(async () => {
    const config = await loadFixture('error')
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')

    consola.wrapConsole()
  })

  test('/ should display an error', async () => {
    await expect(nuxt.server.renderRoute('/error')).rejects.toMatchObject({
      message: expect.stringContaining('not_defined is not defined')
    })
  })

  test('/404 should display an error too', async () => {
    const { error } = await nuxt.server.renderRoute('/404')
    expect(error.message).toContain('This page could not be found')
  })

  test('/ with renderAndGetWindow()', async () => {
    await expect(nuxt.server.renderAndGetWindow(url('/error'))).rejects.toMatchObject({
      statusCode: 500
    })
  })

  test('Error: resolvePath()', () => {
    expect(() => nuxt.resolver.resolvePath()).toThrowError()
    expect(() => nuxt.resolver.resolvePath('@/pages/not-found.vue')).toThrowError('Cannot resolve "@/pages/not-found.vue"')
  })

  test('Error: callHook()', async () => {
    consola.fatal.mockClear()

    const errorHook = jest.fn()
    const error = new Error('test hook error')

    nuxt.hook('error', errorHook)
    nuxt.hook('test:error', () => { throw error })
    await nuxt.callHook('test:error')

    expect(errorHook).toHaveBeenCalledTimes(1)
    expect(errorHook).toHaveBeenCalledWith(error)
    expect(consola.fatal).toHaveBeenCalledTimes(1)
    expect(consola.fatal).toHaveBeenCalledWith(error)
  })

  test('/info should display an error', async () => {
    await expect(nuxt.server.renderRoute('/info')).rejects.toMatchObject({
      message: expect.stringContaining('Cannot read property \'title\' of undefined')
    })
  })

  test('/about should work', async () => {
    await expect(nuxt.server.renderRoute('/about')).resolves.toMatchObject({
      html: expect.stringContaining('About')
    })
  })

  test('/error-square should display an error', async () => {
    await expect(nuxt.server.renderRoute('/squared')).rejects.toMatchObject({
      message: expect.stringContaining('Cannot read property \'data\' of undefined')
    })
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
