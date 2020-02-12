import * as utils from '../../src/utils'
import { mockGetNuxt, mockGetGenerator, NuxtCommand } from '../utils'

describe('export', () => {
  let exportCommand

  beforeAll(async () => {
    exportCommand = await import('../../src/commands/export').then(m => m.default)
    jest.spyOn(process, 'exit').mockImplementation(code => code)
    jest.spyOn(utils, 'forceExit').mockImplementation(() => {})
    jest.spyOn(utils, 'createLock').mockImplementation(() => () => {})
  })

  afterAll(() => {
    process.exit.mockRestore()
  })

  afterEach(() => jest.resetAllMocks())

  test('has run function', () => {
    expect(typeof exportCommand.run).toBe('function')
  })

  test('init by default, build false', async () => {
    mockGetNuxt({ generate: {} })
    const generator = mockGetGenerator()

    await NuxtCommand.from(exportCommand).run()

    expect(generator).toHaveBeenCalled()
    expect(generator.mock.calls[0][0].init).toBe(true)
    expect(generator.mock.calls[0][0].build).toBe(false)
  })

  test('force-exits by default', async () => {
    mockGetNuxt({ generate: {} })
    mockGetGenerator()

    const cmd = NuxtCommand.from(exportCommand, ['export', '.'])
    await cmd.run()

    expect(utils.forceExit).toHaveBeenCalledTimes(1)
    expect(utils.forceExit).toHaveBeenCalledWith('export', 5)
  })

  test('can set force exit explicitly', async () => {
    mockGetNuxt({ generate: {} })
    mockGetGenerator()

    const cmd = NuxtCommand.from(exportCommand, ['export', '.', '--force-exit'])
    await cmd.run()

    expect(utils.forceExit).toHaveBeenCalledTimes(1)
    expect(utils.forceExit).toHaveBeenCalledWith('export', false)
  })

  test('can disable force exit explicitly', async () => {
    mockGetNuxt({ generate: {} })
    mockGetGenerator()

    const cmd = NuxtCommand.from(exportCommand, ['generate', '.', '--no-force-exit'])
    await cmd.run()

    expect(utils.forceExit).not.toHaveBeenCalled()
  })

  test('locks project by default', async () => {
    const releaseLock = jest.fn(() => Promise.resolve())
    const createLock = jest.fn(() => releaseLock)
    jest.spyOn(utils, 'createLock').mockImplementation(createLock)

    mockGetNuxt({ generate: {} })
    mockGetGenerator()

    const cmd = NuxtCommand.from(exportCommand, ['export', '.'])
    await cmd.run()

    expect(createLock).toHaveBeenCalledTimes(1)
    expect(releaseLock).toHaveBeenCalledTimes(1)
  })

  test('can disable locking', async () => {
    mockGetNuxt({ generate: {} })
    mockGetGenerator()

    const createLock = jest.fn(() => Promise.resolve())
    jest.spyOn(utils, 'createLock').mockImplementationOnce(() => createLock)

    const cmd = NuxtCommand.from(exportCommand, ['export', '.', '--no-lock'])
    await cmd.run()

    expect(createLock).not.toHaveBeenCalled()
  })

  test('throw an error when fail-on-error enabled and page errors', async () => {
    mockGetNuxt({ generate: {} })
    mockGetGenerator(() => ({ errors: [{ type: 'dummy' }] }))

    const cmd = NuxtCommand.from(exportCommand, ['export', '.', '--fail-on-error'])
    await expect(cmd.run()).rejects.toThrow('Error exporting pages, exiting with non-zero code')
  })

  test('do not throw an error when fail-on-error disabled and page errors', async () => {
    mockGetNuxt({ generate: {} })
    mockGetGenerator(() => ({ errors: [{ type: 'dummy' }] }))

    const cmd = NuxtCommand.from(exportCommand, ['export', '.'])
    await cmd.run()
  })

  test('do not throw an error when fail-on-error enabled and no page errors', async () => {
    mockGetNuxt({ generate: {} })
    mockGetGenerator()

    const cmd = NuxtCommand.from(exportCommand, ['export', '.', '--fail-on-error'])
    await cmd.run()
  })
})
