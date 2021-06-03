 {
  build:     ,
  hooks: {
     'build:done' (pkg) {
       mono = pkg.load('../..')
       nuxt = pkg.load('../nuxt')

      
       pkg.copyFilesFrom(mono, [
        'LICENSE'
      ])

      pkg.copyFieldsFrom(nuxt, [
        'license',
        'repository',
        'contributors',
        'keywords',
        'engines'
      ])

       pkg.writePackage()
    }
  },
  ignoreUnused: [
    // directly used bin
    '@nuxt/cli',
    // discovered config
    '@nuxt/telemetry',
    // vue-app externals ssr
    'node-fetch',
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
