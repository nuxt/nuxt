import * as utils from '../../src/utils/'
import { mockGetNuxt, mockGetBuilder, mockGetGenerator, NuxtCommand } from '../utils'

describe('build', () => {
  let build

  beforeAll(async () => {
    build = await import('../../src/commands/build').then(m => m.default)
    jest.spyOn(process, 'exit').mockImplementation(code => code)
    jest.spyOn(utils, 'forceExit').mockImplementation(() => {})
  })

  afterEach(() => jest.resetAllMocks())

  test('has run function', () => {
    expect(typeof build.run).toBe('function')
  })

  test('builds on universal mode', async () => {
    mockGetNuxt({
      mode: 'universal',
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
      mode: 'spa',
      build: {
        analyze: false
      }
    })
    const generate = mockGetGenerator(Promise.resolve())

    await NuxtCommand.from(build).run()

    expect(generate).toHaveBeenCalled()
  })

  test('build with devtools', async () => {
    mockGetNuxt({
      mode: 'universal'
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
      mode: 'universal'
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
})
