import consola from 'consola'
import { MODES } from '@nuxt/utils'
import { Nuxt } from '../utils'

const NO_BUILD_MSG = /Use either `nuxt build` or `builder\.build\(\)` or start nuxt in development mode/
const NO_MODERN_BUILD_MSG = /Use either `nuxt build --modern` or `modern` option to build modern files/

describe('renderer', () => {
  afterEach(() => {
    consola.fatal.mockClear()
  })

  test('detect no-build (Universal)', async () => {
    const nuxt = new Nuxt({
      _start: true,
      mode: MODES.universal,
      dev: false,
      buildDir: '/path/to/404'
    })

    await expect(nuxt.ready()).rejects.toThrow(expect.objectContaining({
      message: expect.stringMatching(NO_BUILD_MSG)
    }))
  })

  test('detect no-build (SPA)', async () => {
    const nuxt = new Nuxt({
      _start: true,
      mode: MODES.spa,
      dev: false,
      buildDir: '/path/to/404'
    })

    await expect(nuxt.ready()).rejects.toThrow(expect.objectContaining({
      message: expect.stringMatching(NO_BUILD_MSG)
    }))
  })
  test('detect no-modern-build', async () => {
    const nuxt = new Nuxt({
      _start: true,
      mode: MODES.universal,
      modern: 'client',
      dev: false,
      buildDir: '/path/to/404'
    })

    await expect(nuxt.ready()).rejects.toThrow(expect.objectContaining({
      message: expect.stringMatching(NO_MODERN_BUILD_MSG)
    }))
  })
})
