import { resolve } from 'path'
import consola from 'consola'

import { Nuxt, Options, version } from '../utils'

describe('basic config defaults', () => {
  test('Nuxt.version is same as package', () => {
    expect(Nuxt.version).toBe(version)
  })

  test('modulesDir uses /node_modules as default if not set', async () => {
    const options = Options.from({})
    const currentNodeModulesDir = resolve(__dirname, '..', '..', 'node_modules')
    expect(options.modulesDir.includes(currentNodeModulesDir)).toBe(true)
  })

  test('vendor has been deprecated', async () => {
    jest.spyOn(consola, 'warn')

    const options = Options.from({
      build: { vendor: 'vue' }
    })
    expect(options.build.vendor).toBeUndefined()
    expect(consola.warn).toHaveBeenCalledWith('vendor has been deprecated due to webpack4 optimization')

    consola.warn.mockRestore()
  })

  test('render dist options', async () => {
    const options = Options.from({ render: 'dist' })
    expect(options.render.dist.maxAge).toBe('1y')
    expect(options.render.dist.index).toBe(false)
  })

})
