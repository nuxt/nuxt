import Command from '../../src/command'
import { common, server } from '../../src/options'
import { consola } from '../utils'

jest.mock('@nuxt/core')
jest.mock('@nuxt/builder')
jest.mock('@nuxt/generator')

const allOptions = {
  ...common,
  ...server
}

describe('cli/command', () => {
  beforeEach(() => jest.restoreAllMocks())

  test('builds minimist options', () => {
    const cmd = new Command({ options: allOptions })
    const minimistOptions = cmd._getMinimistOptions()

    expect(minimistOptions.string.length).toBe(5)
    expect(minimistOptions.boolean.length).toBe(4)
    expect(minimistOptions.alias.c).toBe('config-file')
    expect(minimistOptions.default.c).toBe(common['config-file'].default)
  })

  test('parses args', () => {
    const argv = ['-c', 'test-file', '-s', '-p', '3001']
    const cmd = new Command({ options: { ...common, ...server } }, argv)

    expect(cmd.argv['config-file']).toBe(argv[1])
    expect(cmd.argv.spa).toBe(true)
    expect(cmd.argv.universal).toBe(false)
    expect(cmd.argv.port).toBe('3001')

    const cmd2 = new Command({ options: { ...common, ...server } }, ['--no-build'])
    expect(cmd2.argv.build).toBe(false)
  })

  test('prints version automatically', async () => {
    const cmd = new Command({}, ['--version'])
    cmd.showVersion = jest.fn()
    await cmd.run()

    expect(cmd.showVersion).toHaveBeenCalledTimes(1)
  })

  test('prints help automatically', async () => {
    const cmd = new Command({ options: allOptions }, ['-h'])
    cmd.showHelp = jest.fn()
    await cmd.run()

    expect(cmd.showHelp).toHaveBeenCalledTimes(1)
  })

  test('returns nuxt config', async () => {
    const cmd = new Command({ options: allOptions }, ['-c', 'test-file', '-a', '-p', '3001', '-q', '-H'])

    const options = await cmd.getNuxtConfig({ testOption: true })

    expect(options.testOption).toBe(true)
    expect(options.server.port).toBe(3001)
    expect(consola.fatal).toHaveBeenCalledWith('Provided hostname argument has no value') // hostname check
  })

  test('returns Nuxt instance', async () => {
    const cmd = new Command()
    const nuxt = await cmd.getNuxt()

    expect(nuxt.constructor.name).toBe('Nuxt')
    expect(typeof nuxt.ready).toBe('function')
  })

  test('returns Builder instance', async () => {
    const cmd = new Command()
    const builder = await cmd.getBuilder()

    expect(builder.constructor.name).toBe('Builder')
    expect(typeof builder.build).toBe('function')
  })

  test('returns Generator instance', async () => {
    const cmd = new Command()
    const generator = await cmd.getGenerator()

    expect(generator.constructor.name).toBe('Generator')
    expect(typeof generator.generate).toBe('function')
  })

  test('builds help text', () => {
    const cmd = new Command({
      description: 'a very long description that should not wrap to the next line because is not longer ' +
        'than the terminal width',
      usage: 'this is how you do it',
      options: {
        ...allOptions,
        foo: {
          type: 'boolean',
          description: 'very long option that is not longer than the terminal width and ' +
        'should not wrap to the next line'
        }
      }
    })

    expect(cmd._getHelp()).toMatchSnapshot()
  })

  test('show version prints to stdout and exits', () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {})
    const cmd = new Command()
    cmd.showVersion()
    expect(process.stdout.write).toHaveBeenCalled()
    process.stdout.write.mockRestore()
  })

  test('show help prints to stdout and exits', () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {})
    const cmd = new Command()
    cmd.showHelp()
    expect(process.stdout.write).toHaveBeenCalled()
    process.stdout.write.mockRestore()
  })
})
