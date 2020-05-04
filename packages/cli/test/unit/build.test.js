import { MODES, TARGETS } from '@nuxt/utils'
import * as utils from '../../src/utils'
import { mockGetNuxt, mockGetBuilder, mockGetGenerator, NuxtCommand } from '../utils'

describe('build', () => {
  let build

  beforeAll(async () => {
    build = await import('../../src/commands/build').then(m => m.default)
    jest.spyOn(process, 'exit').mockImplementation(code => code)
    jest.spyOn(utils, 'forceExit').mockImplementation(() => {})
    jest.spyOn(utils, 'createLock').mockImplementation(() => () => {})
  })

  afterAll(() => {
    process.exit.mockRestore()
  })

  afterEach(() => jest.resetAllMocks())

  test('has run function', () => {
    expect(typeof build.run).toBe('function')
  })

  test('builds on universal mode', async () => {
    mockGetNuxt({
      mode: MODES.universal,
      build: {
        analyze: true
      }
    })
    const builder = mockGetBuilder(Promise.resolve())

    await NuxtCommand.from(build).run()

    expect(builder).toHaveBeenCalled()
  })

  test('generates on spa mode', async () => {
    mockGetNuxt({
      mode: MODES.spa,
      target: TARGETS.server,
      build: {
        analyze: false
      }
    })
    const generate = mockGetGenerator()

    await NuxtCommand.from(build).run()

    expect(generate).toHaveBeenCalled()
  })

  test('build with devtools', async () => {
    mockGetNuxt({
      mode: MODES.universal
    })
    const builder = mockGetBuilder(Promise.resolve())

    const cmd = NuxtCommand.from(build, ['build', '.', '--devtools'])

    const options = await cmd.getNuxtConfig(cmd.argv)

    await cmd.run()

    expect(options.vue.config.devtools).toBe(true)
    expect(builder).toHaveBeenCalled()
  })

  test('build with modern mode', async () => {
    mockGetNuxt({
      mode: MODES.universal
    })
    mockGetBuilder(Promise.resolve())

    const cmd = NuxtCommand.from(build, ['build', '.', '--m'])

    const options = await cmd.getNuxtConfig()

    await cmd.run()

    expect(options.modern).toBe(true)
  })

  test('build force-exits by default', async () => {
    mockGetNuxt()
    mockGetBuilder(Promise.resolve())

    const cmd = NuxtCommand.from(build, ['build', '.'])
    await cmd.run()

    expect(utils.forceExit).toHaveBeenCalledTimes(1)
    expect(utils.forceExit).toHaveBeenCalledWith('build', 5)
  })

  test('build can set force exit explicitly', async () => {
    mockGetNuxt()
    mockGetBuilder(Promise.resolve())

    const cmd = NuxtCommand.from(build, ['build', '.', '--force-exit'])
    await cmd.run()

    expect(utils.forceExit).toHaveBeenCalledTimes(1)
    expect(utils.forceExit).toHaveBeenCalledWith('build', false)
  })

  test('build can disable force exit explicitly', async () => {
    mockGetNuxt()
    mockGetBuilder(Promise.resolve())

    const cmd = NuxtCommand.from(build, ['build', '.', '--no-force-exit'])
    await cmd.run()

    expect(utils.forceExit).not.toHaveBeenCalled()
  })

  test('build locks project by default', async () => {
    mockGetNuxt({
      mode: MODES.universal
    })
    mockGetBuilder(Promise.resolve())

    const releaseLock = jest.fn(() => Promise.resolve())
    const createLock = jest.fn(() => releaseLock)
    jest.spyOn(utils, 'createLock').mockImplementation(createLock)

    const cmd = NuxtCommand.from(build, ['build', '.'])
    await cmd.run()

    expect(createLock).toHaveBeenCalledTimes(1)
    expect(releaseLock).toHaveBeenCalledTimes(1)
  })

  test('build can disable locking', async () => {
    mockGetNuxt({
      mode: MODES.universal
    })
    mockGetBuilder(Promise.resolve())

    const createLock = jest.fn(() => Promise.resolve())
    jest.spyOn(utils, 'createLock').mockImplementationOnce(() => createLock)

    const cmd = NuxtCommand.from(build, ['build', '.', '--no-lock'])
    await cmd.run()

    expect(createLock).not.toHaveBeenCalled()
  })
})
