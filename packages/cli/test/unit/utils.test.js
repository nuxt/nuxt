import { getDefaultNuxtConfig } from '@nuxt/config'
import { consola } from '../utils'
import { loadNuxtConfig } from '../../src/utils/config'
import * as utils from '../../src/utils'
import { showBanner } from '../../src/utils/banner'
import { showMemoryUsage } from '../../src/utils/memory'
import * as fmt from '../../src/utils/formatting'

jest.mock('std-env', () => ({
  test: false,
  minimalCLI: false
}))
jest.mock('boxen', () => text => `[boxen] ${text}`)

describe('cli/utils', () => {
  afterEach(() => jest.resetAllMocks())

  test('loadNuxtConfig: defaults', async () => {
    const argv = {
      _: ['.'],
      'config-file': 'nuxt.config.js',
      universal: true
    }

    const options = await loadNuxtConfig(argv)
    expect(options.rootDir).toBe(process.cwd())
    expect(options.mode).toBe('universal')
    expect(options.server.host).toBe('localhost')
    expect(options.server.port).toBe(3000)
    expect(options.server.socket).not.toBeDefined()
  })

  test('loadNuxtConfig: config-file', async () => {
    const argv = {
      _: [__dirname],
      'config-file': '../fixtures/nuxt.config.js',
      spa: true
    }

    const options = await loadNuxtConfig(argv)
    expect(options.testOption).toBe(true)
    expect(options.rootDir).toBe('/some/path')
    expect(options.mode).toBe('spa')
    expect(options.server.host).toBe('nuxt-host')
    expect(options.server.port).toBe(3001)
    expect(options.server.socket).toBe('/var/run/nuxt.sock')
  })

  test('loadNuxtConfig: not-existing config-file', async () => {
    const argv = {
      _: [__dirname],
      'config-file': '../fixtures/nuxt.doesnt-exist.js'
    }

    const options = await loadNuxtConfig(argv)
    expect(options.testOption).not.toBeDefined()

    expect(consola.fatal).toHaveBeenCalledTimes(1)
    expect(consola.fatal).toHaveBeenCalledWith(expect.stringMatching(/Could not load config file/))
  })

  test('loadNuxtConfig: async config-file', async () => {
    const argv = {
      _: [__dirname],
      'config-file': '../fixtures/nuxt.async-config.js',
      hostname: 'async-host',
      port: 3002,
      'unix-socket': '/var/run/async.sock'
    }

    const options = await loadNuxtConfig(argv)
    expect(options.testOption).toBe(true)
    expect(options.mode).toBe('supercharged')
    expect(options.server.host).toBe('async-host')
    expect(options.server.port).toBe(3002)
    expect(options.server.socket).toBe('/var/run/async.sock')
  })

  test('loadNuxtConfig: async config-file with error', async () => {
    const argv = {
      _: [__dirname],
      'config-file': '../fixtures/nuxt.async-error.js'
    }

    const options = await loadNuxtConfig(argv)
    expect(options.testOption).not.toBeDefined()

    expect(consola.error).toHaveBeenCalledTimes(1)
    expect(consola.error).toHaveBeenCalledWith(new Error('Async Config Error'))
    expect(consola.fatal).toHaveBeenCalledWith('Error while fetching async configuration')
  })

  test('normalizeArg: normalize string argument in command', () => {
    expect(utils.normalizeArg('true')).toBe(true)
    expect(utils.normalizeArg('false')).toBe(false)
    expect(utils.normalizeArg(true)).toBe(true)
    expect(utils.normalizeArg(false)).toBe(false)
    expect(utils.normalizeArg('')).toBe(true)
    expect(utils.normalizeArg(undefined, 'default')).toBe('default')
    expect(utils.normalizeArg('text')).toBe('text')
  })

  test('nuxtServerConfig: server env', () => {
    const options = getDefaultNuxtConfig({
      env: {
        ...process.env,
        HOST: 'env-host',
        PORT: 3003,
        UNIX_SOCKET: '/var/run/env.sock'
      }
    })

    expect(options.server.host).toBe('env-host')
    expect(options.server.port).toBe(3003)
    expect(options.server.socket).toBe('/var/run/env.sock')
  })

  test('indent', () => {
    expect(fmt.indent(4)).toBe('    ')
  })

  test('indent custom char', () => {
    expect(fmt.indent(4, '-')).toBe('----')
  })

  test('showBanner prints full-info box with memory usage', () => {
    const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => {})
    const successBox = jest.fn().mockImplementation((m, t) => t + m)
    jest.spyOn(fmt, 'successBox').mockImplementation(successBox)

    const badgeMessages = [ 'badgeMessage' ]
    const listeners = [
      { url: 'first' },
      { url: 'second' }
    ]

    showBanner({
      options: {
        cli: {
          badgeMessages
        }
      },
      server: {
        listeners
      }
    })

    expect(successBox).toHaveBeenCalledTimes(1)
    expect(stdout).toHaveBeenCalledTimes(1)
    expect(stdout).toHaveBeenCalledWith(expect.stringMatching('Nuxt.js'))
    expect(stdout).toHaveBeenCalledWith(expect.stringMatching(`Listening on: ${listeners[0].url}`))
    expect(stdout).toHaveBeenCalledWith(expect.stringMatching(`Listening on: ${listeners[1].url}`))
    expect(stdout).toHaveBeenCalledWith(expect.stringMatching('Memory usage'))
    expect(stdout).toHaveBeenCalledWith(expect.stringMatching('badgeMessage'))
    stdout.mockRestore()
  })

  test('showBanner doesnt print memory usage', () => {
    const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => {})
    const successBox = jest.fn().mockImplementation((m, t) => t + m)
    jest.spyOn(fmt, 'successBox').mockImplementation(successBox)

    showBanner({
      options: {
        cli: {
          badgeMessages: []
        }
      },
      server: {
        listeners: []
      }
    }, false)

    expect(successBox).toHaveBeenCalledTimes(1)
    expect(stdout).toHaveBeenCalledTimes(1)
    expect(stdout).toHaveBeenCalledWith(expect.stringMatching('Nuxt.js'))
    expect(stdout).not.toHaveBeenCalledWith(expect.stringMatching('Memory usage'))
    stdout.mockRestore()
  })

  test('showMemoryUsage prints memory usage', () => {
    showMemoryUsage()

    expect(consola.info).toHaveBeenCalledTimes(1)
    expect(consola.info).toHaveBeenCalledWith(expect.stringMatching('Memory usage'))
  })

  test('forceExit exits after timeout', () => {
    jest.useFakeTimers()
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => {})
    const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => {})

    utils.forceExit('test', 1)
    expect(exit).not.toHaveBeenCalled()
    jest.runAllTimers()

    expect(stderr).toHaveBeenCalledTimes(1)
    expect(stderr).toHaveBeenCalledWith(expect.stringMatching('Nuxt.js will now force exit'))
    expect(exit).toHaveBeenCalledTimes(1)

    stderr.mockRestore()
    exit.mockRestore()
    jest.useRealTimers()
  })

  test('forceExit exits immediately without timeout', () => {
    jest.useFakeTimers()
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => {})
    const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => {})

    utils.forceExit('test', false)
    expect(stderr).not.toHaveBeenCalledWith()
    expect(exit).toHaveBeenCalledTimes(1)

    stderr.mockRestore()
    exit.mockRestore()
    jest.useRealTimers()
  })
})
