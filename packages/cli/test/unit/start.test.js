import fs from 'fs-extra'
import * as utils from '../../src/utils/'
import { consola, mockGetNuxtStart, mockGetNuxtConfig, NuxtCommand } from '../utils'

describe('start', () => {
  let start

  beforeAll(async () => {
    start = await import('../../src/commands/start').then(m => m.default)
    // TODO: Below spyOn can be removed in v3 when force-exit is default false
    jest.spyOn(utils, 'forceExit').mockImplementation(() => {})
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
