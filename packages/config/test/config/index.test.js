import { getDefaultNuxtConfig } from '../../src/config'

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
