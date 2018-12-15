import { consola, mockGetNuxt, mockGetGenerator, NuxtCommand } from '../utils'
import Command from '../../src/command'

describe('generate', () => {
  let generate

  beforeAll(async () => {
    generate = await import('../../src/commands/generate').then(m => m.default)
    jest.spyOn(process, 'exit').mockImplementation(code => code)
  })

  afterAll(() => process.exit.mockRestore())
  afterEach(() => jest.resetAllMocks())

  test('has run function', () => {
    expect(typeof generate.run).toBe('function')
  })

  test('builds by default', async () => {
    mockGetNuxt()
    const generator = mockGetGenerator(Promise.resolve())

    await NuxtCommand.from(generate).run()

    expect(generator).toHaveBeenCalled()
    expect(generator.mock.calls[0][0].build).toBe(true)
  })

  test('doesnt build with no-build', async () => {
    mockGetNuxt()
    const getArgv = Command.prototype.getArgv
    Command.prototype.getArgv = jest.fn().mockImplementationOnce(() => {
      return {
        '_': ['.'],
        rootDir: '.',
        'config-file': 'nuxt.config.js',
        build: false
      }
    })
    const generator = mockGetGenerator(Promise.resolve())

    await NuxtCommand.from(generate).run()

    expect(generator).toHaveBeenCalled()
    expect(generator.mock.calls[0][0].build).toBe(false)
    Command.prototype.getArgv = getArgv
  })

  test('build with devtools', async () => {
    mockGetNuxt()
    const generator = mockGetGenerator(Promise.resolve())

    const cmd = NuxtCommand.from(generate)
    const args = ['generate', '.', '--devtools']
    const argv = cmd.getArgv(args)
    argv._ = ['.']

    const options = await cmd.getNuxtConfig(argv)

    await cmd.run()

    expect(options.vue.config.devtools).toBe(true)
    expect(generator).toHaveBeenCalled()
    expect(generator.mock.calls[0][0].build).toBe(true)
  })

  test('generate with modern mode', async () => {
    mockGetNuxt()
    mockGetGenerator(Promise.resolve())

    const cmd = NuxtCommand.from(generate)
    const args = ['generate', '.', '--m']

    const options = await cmd.getNuxtConfig(cmd.getArgv(args))

    await cmd.run()

    expect(options.modern).toBe('client')
  })

  test('catches error', async () => {
    mockGetNuxt()
    mockGetGenerator(Promise.reject(new Error('Generator Error')))

    await NuxtCommand.from(generate).run()

    expect(consola.fatal).toHaveBeenCalledWith(new Error('Generator Error'))
  })
})
