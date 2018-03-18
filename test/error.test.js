// import rp from 'request-promise-native'
import { Nuxt, Builder } from '..'
import { loadConfig } from './helpers/config'

const port = 4005
const url = route => 'http://localhost:' + port + route

let nuxt = null
// let logSpy

describe('error', () => {
  // Init nuxt.js and create server listening on localhost:4000
  beforeAll(async () => {
    const config = loadConfig('error', { dev: false })

    nuxt = new Nuxt(config)
    new Builder(nuxt).build()
    await nuxt.listen(port, 'localhost')
  }, 30000)

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

    // release()
    // expect(errorSpy.calledOnce).toBe(true)
    // expect(errorSpy
    // .getCall(0)
    // .args[0].message.includes(
    // 'render function or template not defined in component: anonymous'
    // )).toBe(true)
  })

  // test('/ with text/json content', async () => {
  //   const opts = {
  //     headers: {
  //       accept: 'application/json'
  //     },
  //     resolveWithFullResponse: true
  //   }
  // const errorSpy = await interceptError()
  // const { response: { headers } } = await expect(rp(url('/'), opts)).toThrow()
  // expect(headers['content-type']).toBe('text/json; charset=utf-8')
  // release()
  // expect(errorSpy.calledOnce).toBe(true)
  // expect(errorSpy
  //   .getCall(0)
  //   .args[0].message.includes(
  //     'render function or template not defined in component: anonymous'
  //   )).toBe(true)
  // })

  // test('Deprecated: dev in build.extend()', async () => {
  // expect(logSpy.calledWith('[build:done]: hook error')).toBe(true)
  // })

  test('Error: resolvePath()', async () => {
    expect(() => nuxt.resolvePath()).toThrowError(TypeError)

    expect(() => nuxt.resolvePath('@/pages/about.vue')).toThrowError('Cannot resolve "@/pages/about.vue"')
  })

  // Close server and ask nuxt to stop listening to file changes
  test('Closing server and nuxt.js', async () => {
    await nuxt.close()
  })
})
