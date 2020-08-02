export interface ServerProcessEnv extends NodeJS.ProcessEnv {
  NUXT_HOST?: string
  NUXT_PORT?: string
  HOST?: string
  PORT?: string
  UNIX_SOCKET?: string
  npm_package_config_nuxt_port?: string
  npm_package_config_nuxt_host?: string
  npm_package_config_unix_socket?: string
}

export default ({ env = {} }: { env?: ServerProcessEnv } = {}) => ({
  https: false as false | {
    cert?: string | Buffer
    key?: string | Buffer
  },
  port: env.NUXT_PORT ||
    env.PORT ||
    env.npm_package_config_nuxt_port ||
    3000,
  host: env.NUXT_HOST ||
    env.HOST ||
    env.npm_package_config_nuxt_host ||
    'localhost',
  socket: env.UNIX_SOCKET ||
    env.npm_package_config_unix_socket,
  timing: false as false | { total: boolean }
}) 
