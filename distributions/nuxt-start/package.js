export default {
  build: true,
  hooks: {
    async 'build:done' (pkg) {
      const mono = pkg.load('../..')
      const nuxt = pkg.load('../nuxt')

      await pkg.copyFilesFrom(mono, [
        'LICENSE'
      ])

      pkg.copyFieldsFrom(nuxt, [
        'license',
        'repository',
        'contributors',
        'keywords',
        'engines'
      ])

      await pkg.writePackage()
    }
  },
  ignoreUnused: [
    // directly used by bin
    '@nuxt/cli',
    // discovered by config
    '@nuxt/telemetry',
    // vue-app externals for ssr
    'node-fetch-native',
    'vue',
    'vue-client-only',
    'vue-meta',
    'vue-no-ssr',
    'vue-router',
    'vuex',
    // Distro
    '@nuxt/config',
    '@nuxt/server',
    '@nuxt/utils',
    '@nuxt/vue-renderer'
  ]
}
