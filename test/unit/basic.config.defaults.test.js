import { resolve } from 'path'
import consola from 'consola'

import { Nuxt, Options, version } from '../utils'

describe('basic config defaults', () => {
  test('Nuxt.version is same as package', () => {
    expect(Nuxt.version).toBe(version)
  })

  test('modulesDir uses /node_modules as default if not set', () => {
    const options = Options.from({})
    const currentNodeModulesDir = resolve(__dirname, '..', '..', 'node_modules')
    expect(options.modulesDir.includes(currentNodeModulesDir)).toBe(true)
  })

  test('vendor has been deprecated', () => {
    const options = Options.from({
      build: { vendor: 'vue' }
    })
    expect(options.build.vendor).toBeUndefined()
    expect(consola.warn).toHaveBeenCalledWith('vendor has been deprecated due to webpack4 optimization')
  })

  test('globalName uses nuxt as default if not set', async () => {
    const options = Options.from({})
    expect(options.globalName).toEqual('nuxt')
  })

  test('globalName uses nuxt as default if set to something other than only letters', async () => {
    let options = Options.from({ globalName: '12foo4' })
    expect(options.globalName).toEqual('nuxt')

    options = Options.from({ globalName: 'foo bar' })
    expect(options.globalName).toEqual('nuxt')

    options = Options.from({ globalName: 'foo?' })
    expect(options.globalName).toEqual('nuxt')
  })
})
