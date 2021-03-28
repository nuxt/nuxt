export default {
  https: false,
  port: process.env.NUXT_PORT || process.env.PORT || process.env.npm_package_config_nuxt_port || 3000,
  host: process.env.NUXT_HOST || process.env.HOST || process.env.npm_package_config_nuxt_host || 'localhost',
  socket: process.env.UNIX_SOCKET || process.env.npm_package_config_unix_socket,
  timing: (val: any) => val ? ({ total: true, ...val }) : false
}
