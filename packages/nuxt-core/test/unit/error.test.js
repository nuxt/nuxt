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
    port = await getPort()
    await nuxt.listen(port, 'localhost')
  })

  test('/ should display an error', async () => {
    await expect(nuxt.renderRoute('/')).rejects.toMatchObject({
      message: expect.stringContaining('not_defined is not defined')
    })
  })

  test('/404 should display an error too', async () => {
    const { error } = await nuxt.renderRoute('/404')
    expect(error.message.includes('This page could not be found')).toBe(true)
  })

  test('/ with renderAndGetWindow()', async () => {
    await expect(nuxt.renderAndGetWindow(url('/'))).rejects.toMatchObject({
      statusCode: 500
    })
  })

  test('Error: resolvePath()', () => {
    expect(() => nuxt.resolvePath()).toThrowError()
    expect(() => nuxt.resolvePath('@/pages/about.vue')).toThrowError('Cannot resolve "@/pages/about.vue"')
  })

  test('Error: callHook()', async () => {
    consola.error.mockClear()

    const errorHook = jest.fn()
    const error = new Error('test hook error')

    nuxt.hook('error', errorHook)
    nuxt.hook('test:error', () => { throw error })
    await nuxt.callHook('test:error')

    expect(errorHook).toHaveBeenCalledTimes(1)
    expect(errorHook).toHaveBeenCalledWith(error)
    expect(consola.error).toHaveBeenCalledTimes(1)
    expect(consola.error).toHaveBeenCalledWith(error)
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
