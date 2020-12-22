export default {
  build: true,
  hooks: {
    async 'build:done' (pkg) {
      const mono = pkg.load('../..')

      await pkg.copyFilesFrom(mono, [
        'LICENSE',
        'README.md'
      ])
    }
  },
  ignoreUnused: [
    // used by postinstall
    '@nuxt/opencollective',
    // discovered by config
    '@nuxt/components',
    '@nuxt/loading-screen',
    '@nuxt/telemetry',
    // Distro
    '@nuxt/babel-preset-app',
    '@nuxt/config',
    '@nuxt/server',
    '@nuxt/utils',
    '@nuxt/vue-app',
    '@nuxt/vue-renderer',
    '@nuxt/webpack'
  ]
}
