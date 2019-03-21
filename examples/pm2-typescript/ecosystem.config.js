module.exports = {
  apps: [
    {
      name: 'pm2-nuxt-typescript',
      script: './node_modules/.bin/nuxt',
      args: 'start',
      instances: 2,
      exec_mode: 'cluster',
      wait_ready: true,
      listen_timeout: 5000
    }
  ]
}
