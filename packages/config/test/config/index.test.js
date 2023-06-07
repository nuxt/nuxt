import { getDefaultNuxtConfig } from '../../src/config'

jest.mock('std-env', () => ({
  isBrowser: false,
  isTest: true,
  isDevelopment: false,
  isProduction: true,
  isDebug: false,
  isCI: true,
  isWindows: false,
  isMacOS: false,
  isLinux: true
}))

describe('config', () => {
  test('should return default nuxt configurations', () => {
    expect(getDefaultNuxtConfig()).toMatchSnapshot()
  })

  test('should return nuxt configurations with custom env', () => {
    const env = {
      NUXT_PORT: '3001',
      NUXT_HOST: 'localhost',
      UNIX_SOCKET: '/var/run/nuxt.sock'
    }
    const config = getDefaultNuxtConfig({ env })
    config.buildModules = config.buildModules.filter(p => p.name !== 'patchMD4')
    expect(config).toMatchSnapshot()
  })
})
