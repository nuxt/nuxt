import * as CoreImport from '@nuxt/core'
import * as BuilderImport from '@nuxt/builder'
import { consola } from '../utils'
import Command from '../../src/common/command'
import Options from '../../src/common/options'

jest.mock('@nuxt/core')
jest.mock('@nuxt/builder')

describe('cli/command', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  test('adds default options', () => {
    const cmd = new Command()

    expect(cmd.options.length).not.toBe(0)
  })

  test('builds minimist options', () => {
    const cmd = new Command({
      options: Object.keys(Options)
    })

    const minimistOptions = cmd.buildMinimistOptions()

    expect(minimistOptions.string.length).toBe(4)
    expect(minimistOptions.boolean.length).toBe(9)
    expect(minimistOptions.alias.c).toBe('config-file')
    expect(minimistOptions.default.c).toBe(Options['config-file'].default)
  })

  test('parses args', () => {
    const cmd = new Command({
      options: Object.keys(Options)
    })

    let args = ['-c', 'test-file', '-s', '-p', '3001']
    let argv = cmd.getArgv(args)

    expect(argv['config-file']).toBe(args[1])
    expect(argv.spa).toBe(true)
    expect(argv.universal).toBe(false)
    expect(argv.build).toBe(true)
    expect(argv.port).toBe('3001')

    args = ['--no-build']
    argv = cmd.getArgv(args)

    expect(argv.build).toBe(false)
  })

  test('prints version automatically', () => {
    const cmd = new Command()
    cmd.showVersion = jest.fn()

    const args = ['--version']
    cmd.getArgv(args)

    expect(cmd.showVersion).toHaveBeenCalledTimes(1)
  })

  test('prints help automatically', () => {
    const cmd = new Command()
    cmd.showHelp = jest.fn()

    const args = ['-h']
    cmd.getArgv(args)

    expect(cmd.showHelp).toHaveBeenCalledTimes(1)
  })

  test('returns nuxt config', async () => {
    const cmd = new Command({
      options: Object.keys(Options)
    })

    const args = ['-c', 'test-file', '-a', '-p', '3001', '-q', '-H']
    const argv = cmd.getArgv(args)
    argv._ = ['.']

    const options = await cmd.getNuxtConfig(argv, { testOption: true })

    expect(options.testOption).toBe(true)
    expect(options.server.port).toBe(3001)
    expect(options.build.quiet).toBe(true)
    expect(options.build.analyze).toBe(true)
    expect(consola.fatal).toHaveBeenCalledWith('Provided hostname argument has no value') // hostname check
  })

  test('imports @nuxt/core', async () => {
    const cmd = new Command()

    expect(await cmd.importCore()).toBe(CoreImport)
  })

  test('imports @nuxt/builder', async () => {
    const cmd = new Command()

    expect(await cmd.importBuilder()).toBe(BuilderImport)
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
      description: 'a very long description that is longer than 80 chars and ' +
        'should wrap to the next line while keeping indentation',
      usage: 'this is how you do it',
      options: ['build']
    })

    const expectedText = `
    Description
      a very long description that is longer than 80 chars and should wrap to the next
      line while keeping indentation
    Usage
      $ nuxt this is how you do it
    Options
      --no-build         Only generate pages for dynamic routes. Nuxt has to be
                         built once before using this option
      --spa, -s          Launch in SPA mode
      --universal, -u    Launch in Universal mode (default)
      --config-file, -c  Path to Nuxt.js config file (default: nuxt.config.js)
      --version          Display the Nuxt version
      --help, -h         Display this message

`
    expect(cmd.buildHelp()).toBe(expectedText)
  })

  test('show version prints to stdout and exits', () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {})
    jest.spyOn(process, 'exit').mockImplementationOnce(code => code)

    const cmd = new Command()
    cmd.showVersion()

    expect(process.stdout.write).toHaveBeenCalled()
    expect(process.exit).toHaveBeenCalled()

    process.stdout.write.mockRestore()
    process.exit.mockRestore()
  })

  test('show help prints to stdout and exits', () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {})
    jest.spyOn(process, 'exit').mockImplementationOnce(code => code)

    const cmd = new Command()
    cmd.showHelp()

    expect(process.stdout.write).toHaveBeenCalled()
    expect(process.exit).toHaveBeenCalled()

    process.stdout.write.mockRestore()
    process.exit.mockRestore()
  })
})
