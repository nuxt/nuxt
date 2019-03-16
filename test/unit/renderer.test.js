import consola from 'consola'
import { Nuxt } from '../utils'

const NO_BUILD_MSG = 'No build files found in /path/to/404/dist/server.\nUse either `nuxt build` or `builder.build()` or start nuxt in development mode.'
const NO_MODERN_BUILD_MSG = 'No modern build files found in /path/to/404/dist/server.\nUse either `nuxt build --modern` or `modern` option to build modern files.'

describe('renderer', () => {
  afterEach(() => {
    consola.fatal.mockClear()
  })

  test('detect no-build (Universal)', async () => {
    const nuxt = new Nuxt({
      _start: true,
      mode: 'universal',
      dev: false,
      buildDir: '/path/to/404'
    })
    await nuxt.ready()
    await expect(nuxt.renderer.renderer.isReady).toBe(false)
    expect(consola.fatal).toHaveBeenCalledWith(new Error(NO_BUILD_MSG))
  })

  test('detect no-build (SPA)', async () => {
    const nuxt = new Nuxt({
      _start: true,
      mode: 'spa',
      dev: false,
      buildDir: '/path/to/404'
    })
    await nuxt.ready()
    await expect(nuxt.renderer.renderer.isReady).toBe(false)
    expect(consola.fatal).toHaveBeenCalledWith(new Error(NO_BUILD_MSG))
  })
  test('detect no-modern-build', async () => {
    const nuxt = new Nuxt({
      _start: true,
      mode: 'universal',
      modern: 'client',
      dev: false,
      buildDir: '/path/to/404'
    })
    await nuxt.ready()
    await expect(nuxt.renderer.renderer.isModernReady).toBe(false)
    expect(consola.fatal).toHaveBeenCalledWith(new Error(NO_MODERN_BUILD_MSG))
  })
})
