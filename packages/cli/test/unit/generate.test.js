import { consola, mockGetNuxt, mockGetGenerator, wrapAndRun } from '../utils'
import Command from '../../src/command'

describe('generate', () => {
  let generate

  beforeAll(async () => {
    generate = await import('../../src/commands/generate').then(m => m.default)

    jest.spyOn(process, 'exit').mockImplementation(code => code)
  })

  afterAll(() => {
    process.exit.mockRestore()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  test('is function', () => {
    expect(typeof generate).toBe('function')
  })

  test('builds by default', async () => {
    mockGetNuxt()
    const generator = mockGetGenerator(Promise.resolve())

    await wrapAndRun(generate)

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

    await wrapAndRun(generate)

    expect(generator).toHaveBeenCalled()
    expect(generator.mock.calls[0][0].build).toBe(false)
    Command.prototype.getArgv = getArgv
  })

  test('catches error', async () => {
    mockGetNuxt()
    mockGetGenerator(Promise.reject(new Error('Generator Error')))

    await wrapAndRun(generate)

    expect(consola.fatal).toHaveBeenCalledWith(new Error('Generator Error'))
  })
})
