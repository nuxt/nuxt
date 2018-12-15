import fs from 'fs-extra'
import { consola, mockGetNuxtStart, mockGetNuxtConfig, NuxtCommand } from '../utils'

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
})
