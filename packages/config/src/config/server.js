export default ({ env = {} } = {}) => ({
  https: false,
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
  timing: false
})
