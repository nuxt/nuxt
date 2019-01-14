import { getDefaultNuxtConfig } from '../../src/config'

jest.mock('std-env', () => ({
  browser: false,
  test: 'test',
  dev: false,
  production: true,
  debug: false,
  ci: true,
  windows: false,
  darwin: false,
  linux: true
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
    expect(getDefaultNuxtConfig({ env })).toMatchSnapshot()
  })
})
