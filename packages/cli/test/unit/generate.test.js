import * as utils from '../../src/utils'
import { mockGetNuxt, mockGetGenerator, NuxtCommand } from '../utils'

describe('generate', () => {
  let generate

  beforeAll(async () => {
    generate = await import('../../src/commands/generate').then(m => m.default)
    jest.spyOn(process, 'exit').mockImplementation(code => code)
    jest.spyOn(utils, 'forceExit').mockImplementation(() => {})
    jest.spyOn(utils, 'createLock').mockImplementation(() => () => {})
  })

  afterAll(() => {
    process.exit.mockRestore()
  })

  afterEach(() => jest.resetAllMocks())

  test('has run function', () => {
    expect(typeof generate.run).toBe('function')
  })

  test('builds by default', async () => {
    mockGetNuxt()
    const generator = mockGetGenerator()

    await NuxtCommand.from(generate).run()

    expect(generator).toHaveBeenCalled()
    expect(generator.mock.calls[0][0].build).toBe(true)
  })

  test('doesnt build with no-build', async () => {
    mockGetNuxt()
    const generator = mockGetGenerator()

    await NuxtCommand.run(generate, ['generate', '.', '--no-build'])

    expect(generator).toHaveBeenCalled()
    expect(generator.mock.calls[0][0].build).toBe(false)
  })

  test('build with devtools', async () => {
    mockGetNuxt()
    const generator = mockGetGenerator()

    const cmd = NuxtCommand.from(generate, ['generate', '.', '--devtools'])

    const options = await cmd.getNuxtConfig()

    await cmd.run()

    expect(options.vue.config.devtools).toBe(true)
    expect(generator).toHaveBeenCalled()
    expect(generator.mock.calls[0][0].build).toBe(true)
  })

  test('generate with modern mode', async () => {
    mockGetNuxt()
    mockGetGenerator()

    const cmd = NuxtCommand.from(generate, ['generate', '.', '--m'])

    const options = await cmd.getNuxtConfig()

    await cmd.run()

    expect(options.modern).toBe('client')
  })

  test('generate force-exits by default', async () => {
    mockGetNuxt()
    mockGetGenerator()

    const cmd = NuxtCommand.from(generate, ['generate', '.'])
    await cmd.run()

    expect(utils.forceExit).toHaveBeenCalledTimes(1)
    expect(utils.forceExit).toHaveBeenCalledWith('generate', 5)
  })

  test('generate can set force exit explicitly', async () => {
    mockGetNuxt()
    mockGetGenerator()

    const cmd = NuxtCommand.from(generate, ['generate', '.', '--force-exit'])
    await cmd.run()

    expect(utils.forceExit).toHaveBeenCalledTimes(1)
    expect(utils.forceExit).toHaveBeenCalledWith('generate', false)
  })

  test('generate can disable force exit explicitly', async () => {
    mockGetNuxt()
    mockGetGenerator()

    const cmd = NuxtCommand.from(generate, ['generate', '.', '--no-force-exit'])
    await cmd.run()

    expect(utils.forceExit).not.toHaveBeenCalled()
  })

  test('generate locks project by default twice', async () => {
    const releaseLock = jest.fn(() => Promise.resolve())
    const createLock = jest.fn(() => releaseLock)
    jest.spyOn(utils, 'createLock').mockImplementation(createLock)

    let buildDone
    mockGetNuxt({ generate: {} }, {
      hook: (hookName, fn) => (buildDone = fn)
    })

    mockGetGenerator(async () => {
      await buildDone()
      return { errors: [] }
    })

    const cmd = NuxtCommand.from(generate, ['generate', '.'])
    await cmd.run()

    expect(createLock).toHaveBeenCalledTimes(2)
    expect(releaseLock).toHaveBeenCalledTimes(2)
  })

  test('generate can disable locking', async () => {
    mockGetNuxt()
    mockGetGenerator()

    const createLock = jest.fn(() => Promise.resolve())
    jest.spyOn(utils, 'createLock').mockImplementationOnce(() => createLock)

    const cmd = NuxtCommand.from(generate, ['generate', '.', '--no-lock'])
    await cmd.run()

    expect(createLock).not.toHaveBeenCalled()
  })

  test('throw an error when fail-on-error enabled and page errors', async () => {
    mockGetNuxt()
    mockGetGenerator(() => ({ errors: [{ type: 'dummy' }] }))

    const cmd = NuxtCommand.from(generate, ['generate', '.', '--fail-on-error'])
    await expect(cmd.run()).rejects.toThrow('Error generating pages, exiting with non-zero code')
  })

  test('do not throw an error when fail-on-error disabled and page errors', async () => {
    mockGetNuxt()
    mockGetGenerator(() => ({ errors: [{ type: 'dummy' }] }))

    const cmd = NuxtCommand.from(generate, ['generate', '.'])
    await cmd.run()
  })

  test('do not throw an error when fail-on-error enabled and no page errors', async () => {
    mockGetNuxt()
    mockGetGenerator()

    const cmd = NuxtCommand.from(generate, ['generate', '.', '--fail-on-error'])
    await cmd.run()
  })
})
