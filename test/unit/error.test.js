// import rp from 'request-promise-native'
import { loadFixture, getPort, Nuxt } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null
// let logSpy

describe('error', () => {
  beforeAll(async () => {
    const config = loadFixture('error')
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
    let { error } = await nuxt.renderRoute('/404')
    expect(error.message.includes('This page could not be found')).toBe(true)
  })

  test('/ with renderAndGetWindow()', async () => {
    // const errorSpy = await interceptError()
    await expect(nuxt.renderAndGetWindow(url('/'))).rejects.toMatchObject({
      statusCode: 500
    })
  })

  test('Error: resolvePath()', async () => {
    expect(() => nuxt.resolvePath()).toThrowError()
    expect(() => nuxt.resolvePath('@/pages/about.vue')).toThrowError('Cannot resolve "@/pages/about.vue"')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
