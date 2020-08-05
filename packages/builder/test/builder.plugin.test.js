import Glob from 'glob'
import consola from 'consola'
import { isIndexFileAndFolder } from '@nuxt/utils'
import { BundleBuilder } from '@nuxt/webpack'

import Builder from '../src/builder'
import { createNuxt } from './__utils__'

jest.mock('glob')
jest.mock('pify', () => fn => fn)
jest.mock('hash-sum', () => src => `hash(${src})`)
jest.mock('@nuxt/utils')
jest.mock('../src/ignore')
jest.mock('@nuxt/webpack')

describe('builder: builder plugins', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should normalize plugins', async () => {
    const nuxt = createNuxt()
    nuxt.options.plugins = [
      '/var/nuxt/plugins/test.js',
      '/var/nuxt/.nuxt/foo-bar.plugin.client.530b6c6a.js',
      { src: '/var/nuxt/plugins/test.server', mode: 'server' },
      { src: '/var/nuxt/plugins/test.client', ssr: false }
    ]

    const builder = new Builder(nuxt, BundleBuilder)
    const plugins = await builder.normalizePlugins()

    expect(nuxt.callHook).toBeCalledTimes(1)
    expect(nuxt.callHook).toBeCalledWith('builder:extendPlugins', nuxt.options.plugins)

    expect(plugins).toEqual([
      {
        mode: 'all',
        name: 'nuxt_plugin_test_hash(/var/nuxt/plugins/test.js)',
        src: 'resolveAlias(/var/nuxt/plugins/test.js)'
      },
      {
        mode: 'client',
        name: 'nuxt_plugin_foobarpluginclient530b6c6a_hash(/var/nuxt/.nuxt/foo-bar.plugin.client.530b6c6a.js)',
        src: 'resolveAlias(/var/nuxt/.nuxt/foo-bar.plugin.client.530b6c6a.js)'
      },
      {
        mode: 'server',
        name: 'nuxt_plugin_test_hash(/var/nuxt/plugins/test.server)',
        src: 'resolveAlias(/var/nuxt/plugins/test.server)'
      },
      {
        mode: 'client',
        name: 'nuxt_plugin_test_hash(/var/nuxt/plugins/test.client)',
        src: 'resolveAlias(/var/nuxt/plugins/test.client)'
      }
    ])
  })

  test('should overwrite plugins from options', async () => {
    const nuxt = createNuxt()

    nuxt.options.plugins = ['/var/nuxt/plugins/foo-bar.js']
    nuxt.options.extendPlugins = jest.fn().mockReturnValue([
      '/var/nuxt/plugins/fizz-fuzz.js'
    ])

    const builder = new Builder(nuxt, BundleBuilder)
    const plugins = await builder.normalizePlugins()

    expect(nuxt.options.extendPlugins).toHaveBeenCalledTimes(1)
    expect(nuxt.options.extendPlugins).toHaveBeenCalledWith([
      '/var/nuxt/plugins/foo-bar.js'
    ])

    expect(plugins).toEqual([
      {
        mode: 'all',
        name: 'nuxt_plugin_fizzfuzz_hash(/var/nuxt/plugins/fizz-fuzz.js)',
        src: 'resolveAlias(/var/nuxt/plugins/fizz-fuzz.js)'
      }
    ])
  })

  test('should warning and fallback invalid mode when normalize plugins', async () => {
    const nuxt = createNuxt()
    nuxt.options.plugins = [
      { src: '/var/nuxt/plugins/test', mode: 'abc' }
    ]
    const builder = new Builder(nuxt, BundleBuilder)

    const plugins = await builder.normalizePlugins()

    expect(plugins).toEqual([
      {
        mode: 'all',
        name: 'nuxt_plugin_test_hash(/var/nuxt/plugins/test)',
        src: 'resolveAlias(/var/nuxt/plugins/test)'
      }
    ])
    expect(consola.warn).toBeCalledTimes(1)
    expect(consola.warn).toBeCalledWith('Invalid plugin mode (server/client/all): \'abc\'. Falling back to \'all\'')
  })

  test('should resolve plugins', async () => {
    const nuxt = createNuxt()
    const builder = new Builder(nuxt, BundleBuilder)
    builder.plugins = [
      { src: '/var/nuxt/plugins/test.js', mode: 'all' },
      { src: '/var/nuxt/plugins/test.client', mode: 'client' },
      { src: '/var/nuxt/plugins/test.server', mode: 'server' }
    ]
    builder.relativeToBuild = jest.fn(src => `relative(${src})`)
    for (let step = 0; step < builder.plugins.length; step++) {
      Glob.mockImplementationOnce(src => [`${src.replace(/\{.*\}/, '')}.js`])
    }

    await builder.resolvePlugins()

    expect(Glob).toBeCalledTimes(3)
    expect(Glob).nthCalledWith(1, '/var/nuxt/plugins/test.js{?(.+([^.])),/index.+([^.])}')
    expect(Glob).nthCalledWith(2, '/var/nuxt/plugins/test.client{?(.+([^.])),/index.+([^.])}')
    expect(Glob).nthCalledWith(3, '/var/nuxt/plugins/test.server{?(.+([^.])),/index.+([^.])}')
    expect(builder.plugins).toEqual([
      { mode: 'all', src: 'relative(/var/nuxt/plugins/test.js)' },
      { mode: 'client', src: 'relative(/var/nuxt/plugins/test.client)' },
      { mode: 'server', src: 'relative(/var/nuxt/plugins/test.server)' }
    ])
  })

  test('should throw error if plugin no existed', async () => {
    const nuxt = createNuxt()
    const builder = new Builder(nuxt, BundleBuilder)
    builder.plugins = [
      { src: '/var/nuxt/plugins/test.js', mode: 'all' }
    ]
    Glob.mockImplementationOnce(() => [])

    await expect(builder.resolvePlugins()).rejects.toThrow('Plugin not found: /var/nuxt/plugins/test.js')
  })

  test('should warn if there are multiple files and not index', async () => {
    const nuxt = createNuxt()
    const builder = new Builder(nuxt, BundleBuilder)
    builder.plugins = [
      { src: '/var/nuxt/plugins/test', mode: 'all' }
    ]
    builder.relativeToBuild = jest.fn(src => `relative(${src})`)

    Glob.mockImplementationOnce(src => [`${src}.js`])
    isIndexFileAndFolder.mockReturnValueOnce(false)

    await builder.resolvePlugins()

    expect(builder.plugins).toEqual([
      { mode: 'all', src: 'relative(/var/nuxt/plugins/test)' }
    ])
  })

  test('should detect plugin mode for client/server plugins', async () => {
    const nuxt = createNuxt()
    const builder = new Builder(nuxt, BundleBuilder)
    builder.options.plugins = [
      { src: '/var/nuxt/plugins/test.js', mode: 'all' },
      { src: '/var/nuxt/plugins/test.client' },
      { src: '/var/nuxt/plugins/test.server' }
    ]

    const plugins = await builder.normalizePlugins()

    expect(plugins).toEqual([
      {
        mode: 'all',
        src: 'resolveAlias(/var/nuxt/plugins/test.js)',
        name: 'nuxt_plugin_test_hash(/var/nuxt/plugins/test.js)'
      },
      {
        mode: 'client',
        src: 'resolveAlias(/var/nuxt/plugins/test.client)',
        name: 'nuxt_plugin_test_hash(/var/nuxt/plugins/test.client)'
      },
      {
        mode: 'server',
        src: 'resolveAlias(/var/nuxt/plugins/test.server)',
        name: 'nuxt_plugin_test_hash(/var/nuxt/plugins/test.server)'
      }
    ])
  })
})
