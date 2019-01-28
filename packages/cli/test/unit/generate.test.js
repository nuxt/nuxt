import { mockGetNuxt, mockGetGenerator, NuxtCommand } from '../utils'

describe('generate', () => {
  let generate

  beforeAll(async () => {
    generate = await import('../../src/commands/generate').then(m => m.default)
    jest.spyOn(process, 'exit').mockImplementation(code => code)
  })

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
    const generator = mockGetGenerator(Promise.resolve())

    await NuxtCommand.run(generate, ['generate', '.', '--no-build'])

    expect(generator).toHaveBeenCalled()
    expect(generator.mock.calls[0][0].build).toBe(false)
  })

  test('build with devtools', async () => {
    mockGetNuxt()
    const generator = mockGetGenerator(Promise.resolve())

    const cmd = NuxtCommand.from(generate, ['generate', '.', '--devtools'])

    const options = await cmd.getNuxtConfig()

    await cmd.run()

    expect(options.vue.config.devtools).toBe(true)
    expect(generator).toHaveBeenCalled()
    expect(generator.mock.calls[0][0].build).toBe(true)
  })

  test('generate with modern mode', async () => {
    mockGetNuxt()
    mockGetGenerator(Promise.resolve())

    const cmd = NuxtCommand.from(generate, ['generate', '.', '--m'])

    const options = await cmd.getNuxtConfig()

    await cmd.run()

    expect(options.modern).toBe('client')
  })
})
