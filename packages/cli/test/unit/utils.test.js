import consola from 'consola'
import * as utils from '../../src/common/utils'

jest.mock('consola')

describe('cli/utils', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  test('loadNuxtConfig: defaults', async () => {
    const argv = {
      _: ['.'],
      'config-file': 'nuxt.config.js',
      universal: true
    }

    const options = await utils.loadNuxtConfig(argv)
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

    const options = await utils.loadNuxtConfig(argv)
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

    const options = await utils.loadNuxtConfig(argv)
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

    const options = await utils.loadNuxtConfig(argv)
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

    const options = await utils.loadNuxtConfig(argv)
    expect(options.testOption).not.toBeDefined()

    expect(consola.error).toHaveBeenCalledTimes(1)
    expect(consola.error).toHaveBeenCalledWith(new Error('Async Config Error'))
    expect(consola.fatal).toHaveBeenCalledWith('Error while fetching async configuration')
  })

  test('loadNuxtConfig: server env', async () => {
    const env = process.env

    process.env.HOST = 'env-host'
    process.env.PORT = 3003
    process.env.UNIX_SOCKET = '/var/run/env.sock'

    const argv = {
      _: [__dirname],
      'config-file': '../fixtures/nuxt.config.js'
    }

    const options = await utils.loadNuxtConfig(argv)
    expect(options.server.host).toBe('env-host')
    expect(options.server.port).toBe('3003')
    expect(options.server.socket).toBe('/var/run/env.sock')

    process.env = env
  })

  test('indent', () => {
    expect(utils.indent(4)).toBe('    ')
  })

  test('indent custom char', () => {
    expect(utils.indent(4, '-')).toBe('----')
  })

  test('foldLines', () => {
    const str = 'word1 word2 word3'

    expect(utils.foldLines(str, 3).join('|')).toBe('word1|word2|word3')
    expect(utils.foldLines(str, 6).join('|')).toBe('word1|word2|word3')
    expect(utils.foldLines(str, 12).join('|')).toBe('word1 word2|word3')
    expect(utils.foldLines(str, str.length).join('|')).toBe(str)
  })

  test('foldLines with indent', () => {
    const str = 'word1 word2 word3'

    expect(utils.foldLines(str, 3, 2).join('|')).toBe('word1|  word2|  word3')
    expect(utils.foldLines(str, 6, 2).join('|')).toBe('word1|  word2|  word3')
    expect(utils.foldLines(str, 12, 2).join('|')).toBe('word1 word2|  word3')
    expect(utils.foldLines(str, str.length, 2).join('|')).toBe(str)
  })

  test('foldLines anywhere', () => {
    const str = 'word1 word2 word3'

    expect(utils.foldLines(str, 3, 0, true).join('|')).toBe('wor|d1 |wor|d2 |wor|d3')
    expect(utils.foldLines(str, 6, 0, true).join('|')).toBe('word1 |word2 |word3')
    expect(utils.foldLines(str, 12, 0, true).join('|')).toBe('word1 word2 |word3')
    expect(utils.foldLines(str, str.length, 0, true).join('|')).toBe(str)
  })

  test('foldLines anywhere with indent', () => {
    const str = 'word1 word2 word3'

    expect(utils.foldLines(str, 3, 1, true).join('|')).toBe('wor| d1| wo| rd| 2 | wo| rd| 3')
    expect(utils.foldLines(str, 6, 1, true).join('|')).toBe('word1 | word2| word3')
    expect(utils.foldLines(str, 12, 1, true).join('|')).toBe('word1 word2 | word3')
    expect(utils.foldLines(str, str.length, 1, true).join('|')).toBe(str)
  })
})
