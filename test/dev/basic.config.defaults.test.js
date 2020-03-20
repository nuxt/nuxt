import { resolve } from 'path'
import consola from 'consola'
import Glob from 'glob'
import pify from 'pify'

import { Nuxt, getNuxtConfig, version } from '../utils'

const glob = pify(Glob)

describe('basic config defaults', () => {
  test('Nuxt.version is same as package', () => {
    expect(Nuxt.version).toBe(version)
  })

  test('modulesDir uses /node_modules as default if not set', () => {
    const options = getNuxtConfig({})
    const currentNodeModulesDir = resolve(__dirname, '..', '..', 'node_modules')
    expect(options.modulesDir).toContain(currentNodeModulesDir)
  })

  test('client source map not generated', async () => {
    const mapFiles = await glob(resolve(__dirname, '..', 'fixtures/basic/.nuxt/dist/client/*.js.map'))
    expect(mapFiles.length).toEqual(0)
  })

  test('vendor has been deprecated', () => {
    const options = getNuxtConfig({
      build: { vendor: 'vue' }
    })
    expect(options.build.vendor).toBeUndefined()
    expect(consola.warn).toHaveBeenCalledWith('vendor has been deprecated due to webpack4 optimization')
  })

  test('globalName uses nuxt as default if not set', () => {
    const options = getNuxtConfig({})
    expect(options.globalName).toEqual('nuxt')
  })

  test('globalName uses nuxt as default if set to something other than only letters', () => {
    let options = getNuxtConfig({ globalName: '12foo4' })
    expect(options.globalName).toEqual('nuxt')

    options = getNuxtConfig({ globalName: 'foo bar' })
    expect(options.globalName).toEqual('nuxt')

    options = getNuxtConfig({ globalName: 'foo?' })
    expect(options.globalName).toEqual('nuxt')
  })

  test('@nuxtjs/babel-preset-app has been deprecated', () => {
    let options = getNuxtConfig({
      build: {
        babel: {
          presets: ['@nuxtjs/babel-preset-app']
        }
      }
    })
    expect(options.build.babel.presets).toEqual(['@nuxt/babel-preset-app'])
    expect(consola.warn).toHaveBeenCalledWith('@nuxtjs/babel-preset-app has been deprecated, please use @nuxt/babel-preset-app.')

    consola.warn.mockClear()

    options = getNuxtConfig({
      build: {
        babel: {
          presets: [['@nuxtjs/babel-preset-app']]
        }
      }
    })
    expect(options.build.babel.presets).toEqual([['@nuxt/babel-preset-app']])
    expect(consola.warn).toHaveBeenCalledWith('@nuxtjs/babel-preset-app has been deprecated, please use @nuxt/babel-preset-app.')
  })
})
