import fs from 'fs-extra'
import { TARGETS } from '@nuxt/utils'
import * as utils from '../../src/utils/'
import { consola, mockGetNuxtStart, mockGetNuxtConfig, NuxtCommand } from '../utils'

describe('start', () => {
  let start

  beforeAll(async () => {
    start = await import('../../src/commands/start').then(m => m.default)
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

  test('error if starts with static target', () => {
    mockGetNuxtStart()
    mockGetNuxtConfig({ target: TARGETS.static })
    const cmd = NuxtCommand.from(start)
    expect(cmd.run()).rejects.toThrow(new Error('You cannot use `nuxt start` with static target, please use `nuxt export` and `nuxt serve`'))
  })

  test('start doesnt force-exit by default', async () => {
    mockGetNuxtStart()
    mockGetNuxtConfig()

    const cmd = NuxtCommand.from(start, ['start', '.'])
    await cmd.run()

    expect(utils.forceExit).not.toHaveBeenCalled()
  })

  test('start can set force exit explicitly', async () => {
    mockGetNuxtStart()
    mockGetNuxtConfig()

    const cmd = NuxtCommand.from(start, ['start', '.', '--force-exit'])
    await cmd.run()

    expect(utils.forceExit).toHaveBeenCalledTimes(1)
    expect(utils.forceExit).toHaveBeenCalledWith('start', false)
  })

  test('start can disable force exit explicitly', async () => {
    mockGetNuxtStart()
    mockGetNuxtConfig()

    const cmd = NuxtCommand.from(start, ['start', '.', '--no-force-exit'])
    await cmd.run()

    expect(utils.forceExit).not.toHaveBeenCalled()
  })
})
