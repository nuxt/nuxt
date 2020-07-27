import Command from '../../src/command'
import { common, server } from '../../src/options'
import * as utils from '../../src/utils/'
import * as config from '../../src/utils/config'
import * as constants from '../../src/utils/constants'
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

    expect(minimistOptions.string.length).toBe(7)
    expect(minimistOptions.boolean.length).toBe(6)
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
    jest.spyOn(utils, 'forceExit').mockImplementation(() => {})

    const cmd = new Command({}, ['--version'])
    cmd.showVersion = jest.fn()
    await cmd.run()

    expect(cmd.showVersion).toHaveBeenCalledTimes(1)
  })

  test('prints help automatically', async () => {
    jest.spyOn(utils, 'forceExit').mockImplementation(() => {})

    const cmd = new Command({ options: allOptions }, ['-h'])
    cmd.showHelp = jest.fn()
    await cmd.run()

    expect(cmd.showHelp).toHaveBeenCalledTimes(1)
  })

  test('returns nuxt config', async () => {
    const loadConfigSpy = jest.spyOn(config, 'loadNuxtConfig')

    const cmd = new Command({ name: 'test', options: allOptions }, ['-c', 'test-file', '-a', '-p', '3001', '-q', '-H'])

    const options = await cmd.getNuxtConfig({ testOption: true })

    expect(options.testOption).toBe(true)
    expect(options.server.port).toBe(3001)
    expect(consola.fatal).toHaveBeenCalledWith('Provided hostname argument has no value') // hostname check
    expect(loadConfigSpy).toHaveBeenCalledTimes(1)
    expect(loadConfigSpy).toHaveBeenCalledWith(expect.any(Object), {
      command: 'test',
      dev: false,
      env: expect.objectContaining({
        NODE_ENV: 'test'
      })
    })

    loadConfigSpy.mockRestore()
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
    jest.spyOn(constants, 'maxCharsPerLine').mockReturnValue(40)

    const cmd = new Command({
      description: 'a very long description that should wrap to the next line because is not longer ' +
        'than the terminal width',
      usage: 'this is how you do it',
      options: {
        ...allOptions,
        foo: {
          type: 'boolean',
          description: 'very long option that is longer than the terminal width and ' +
        'should wrap to the next line'
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

  test('can set and release lock', () => {
    const release = jest.fn(() => Promise.resolve())
    const cmd = new Command()

    cmd.setLock(release)
    cmd.releaseLock()

    expect(release).toHaveBeenCalledTimes(1)
  })

  test('logs warning when lock already exists and removes old lock', () => {
    const release = jest.fn(() => Promise.resolve())
    const cmd = new Command()

    cmd.setLock(release)
    cmd.setLock(release)

    expect(consola.warn).toHaveBeenCalledTimes(1)
    expect(consola.warn).toHaveBeenCalledWith(expect.stringMatching('A previous unreleased lock was found'))
    expect(release).toHaveBeenCalledTimes(1)

    cmd.releaseLock()
    expect(release).toHaveBeenCalledTimes(2)
  })
})
