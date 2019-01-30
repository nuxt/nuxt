module.exports = {
  apps: [
    {
      name: 'pm2-nuxt-ts',
      script: './node_modules/.bin/nuxt-ts',
      args: 'start',
      instances: 2,
      exec_mode: 'cluster',
      wait_ready: true,
      listen_timeout: 5000
    }
  ]
}
