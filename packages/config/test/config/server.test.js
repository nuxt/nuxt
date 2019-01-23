import serverConfig from '../../src/config/server'

const serverDefaults = serverConfig()

describe('config: server', () => {
  test('should return server configurations with NUXT_* env', () => {
    const env = {
      NUXT_PORT: 3001,
      NUXT_HOST: '127.0.0.1'
    }
    expect(serverConfig({ env })).toEqual({
      ...serverDefaults,
      port: env.NUXT_PORT,
      host: env.NUXT_HOST
    })
  })

  test('should return server configurations with env', () => {
    const env = {
      PORT: 3002,
      HOST: 'local.env',
      UNIX_SOCKET: '/var/run/env.sock'
    }
    expect(serverConfig({ env })).toEqual({
      ...serverDefaults,
      port: env.PORT,
      host: env.HOST,
      socket: env.UNIX_SOCKET
    })
  })

  test('should return server configurations with npm_* env', () => {
    const env = {
      npm_package_config_nuxt_port: 3003,
      npm_package_config_nuxt_host: 'local.npm',
      npm_package_config_unix_socket: '/var/run/env.npm.sock'
    }
    expect(serverConfig({ env })).toEqual({
      ...serverDefaults,
      port: env.npm_package_config_nuxt_port,
      host: env.npm_package_config_nuxt_host,
      socket: env.npm_package_config_unix_socket
    })
  })
})
