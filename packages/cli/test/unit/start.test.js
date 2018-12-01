import fs from 'fs'
import { consola, mockGetNuxtStart, mockGetNuxtConfig, NuxtCommand } from '../utils'

const NO_BUILD_MSG = 'No build files found. Use either `nuxt build` or `builder.build()` or start nuxt in development mode.'

describe('start', () => {
  let start

  beforeAll(async () => {
    start = await import('../../src/commands/start').then(m => m.default)
  })

  afterEach(() => {
    if (fs.existsSync.mockRestore) {
      fs.existsSync.mockRestore()
    }
    jest.resetAllMocks()
  })

  test('has run function', () => {
    expect(typeof start.run).toBe('function')
  })

  test('no error if dist dir exists', async () => {
    mockGetNuxtStart()
    mockGetNuxtConfig()
    await NuxtCommand.from(start).run()
    expect(consola.fatal).not.toHaveBeenCalled()
  })

  test('no error on ssr and server bundle exists', async () => {
    mockGetNuxtStart(true)
    mockGetNuxtConfig()
    await NuxtCommand.from(start).run()
    expect(consola.fatal).not.toHaveBeenCalled()
  })

  test.skip('fatal error when dist does not exist', async () => {
    mockGetNuxtStart(true)
    await NuxtCommand.from(start).run()
    expect(consola.fatal).toHaveBeenCalledWith(NO_BUILD_MSG)
  })
})
