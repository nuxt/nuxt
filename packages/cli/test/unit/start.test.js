import fs from 'fs'
import { consola, mockGetNuxtStart, mockGetNuxtConfig } from '../utils'

describe('start', () => {
  let start

  beforeAll(async () => {
    start = await import('../../src/commands/start')
    start = start.default
  })

  afterEach(() => {
    if (fs.existsSync.mockRestore) {
      fs.existsSync.mockRestore()
    }

    jest.resetAllMocks()
  })

  test('is function', () => {
    expect(typeof start).toBe('function')
  })

  test('starts listening and calls showReady', async () => {
    const { listen, showReady } = mockGetNuxtStart()
    await start()

    expect(listen).toHaveBeenCalled()
    expect(showReady).toHaveBeenCalled()
  })

  test('no error if dist dir exists', async () => {
    mockGetNuxtStart()
    mockGetNuxtConfig()
    jest.spyOn(fs, 'existsSync').mockImplementationOnce(() => true)

    await start()

    expect(consola.fatal).not.toHaveBeenCalled()
  })

  test('fatal error if dist dir doesnt exist', async () => {
    mockGetNuxtStart()
    jest.spyOn(fs, 'existsSync').mockImplementationOnce(() => false)

    await start()

    expect(consola.fatal).toHaveBeenCalledWith('No build files found, please run `nuxt build` before launching `nuxt start`')
  })

  test('no error on ssr and server bundle exists', async () => {
    mockGetNuxtStart(true)
    mockGetNuxtConfig()
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true)

    await start()

    expect(consola.fatal).not.toHaveBeenCalled()
  })

  test('fatal error on ssr and server bundle doesnt exist', async () => {
    mockGetNuxtStart(true)
    jest.spyOn(fs, 'existsSync').mockImplementation(() => false)

    await start()

    expect(consola.fatal).toHaveBeenCalledWith('No SSR build! Please start with `nuxt start --spa` or build using `nuxt build --universal`')
  })
})
