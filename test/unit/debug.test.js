import rp from 'request-promise-native'
import { Nuxt } from '../../'
import { loadFixture, getPort } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe.skip('debug', () => {
  beforeAll(async () => {
    const config = loadFixture('debug')
    nuxt = new Nuxt(config)
    port = await getPort()
    await nuxt.listen(port, 'localhost')
  })

  test('/test/__open-in-editor (open-in-editor)', async () => {
    const { body } = await rp(
      url('/test/__open-in-editor?file=pages/index.vue'),
      { resolveWithFullResponse: true }
    )
    expect(body).toBe('')
  })

  test(
    '/test/__open-in-editor should return error (open-in-editor)',
    async () => {
      await expect(rp(url('/test/__open-in-editor?file='))).rejects.toMatchObject({
        statusCode: 500,
        message: 'launch-editor-middleware: required query param "file" is missing.'
      })
    }
  )

  test('/test/error should return error stack trace (Youch)', async () => {
    // const errorSpy = await interceptError()

    await expect(nuxt.renderAndGetWindow(url('/test/error'))).rejects.toMatchObject({
      response: {
        statusCode: 500,
        statusMessage: 'NuxtServerError'
      },
      error: expect.stringContaining('test youch !')
    })

    // release()
    // expect(errorSpy.calledTwice).toBe(true)
    // expect(errorSpy.getCall(0).args[0].includes('test youch !')).toBe(true)
    // expect(errorSpy.getCall(1).args[0].message.includes('test youch !')).toBe(true)
  })

  test('/test/error no source-map (Youch)', async () => {
    const sourceMaps = nuxt.renderer.resources.serverBundle.maps
    nuxt.renderer.resources.serverBundle.maps = {}

    // const errorSpy = await interceptError()
    await expect(nuxt.renderAndGetWindow(url('/test/error'))).rejects.toMatchObject({
      statusCode: 500,
      error: expect.stringContaining('<div class="error-frames">')
    })
    // release()
    // expect(errorSpy.calledTwice).toBe(true)
    // expect(errorSpy.getCall(0).args[0].includes('test youch !')).toBe(true)
    // expect(errorSpy.getCall(1).args[0].message.includes('test youch !')).toBe(true)

    nuxt.renderer.resources.serverBundle.maps = sourceMaps
  })

  test('/test/error should return json format error (Youch)', async () => {
    const opts = {
      headers: {
        accept: 'application/json'
      },
      resolveWithFullResponse: true
    }
    // const errorSpy = await interceptError()

    await expect(rp(url('/test/error'), opts)).rejects.toMatchObject({
      response: {
        headers: {
          'content-type': 'text/json; charset=utf-8'
        }
      }
    })

    // release()
    // expect(errorSpy.calledTwice).toBe(true)
    // expect(errorSpy.getCall(0).args[0].includes('test youch !')).toBe(true)
    // expect(errorSpy.getCall(1).args[0].message.includes('test youch !')).toBe(true)
  })

  // Close server and ask nuxt to stop listening to file changes
  test('Closing server and nuxt.js', async () => {
    await nuxt.close()
  })
})
