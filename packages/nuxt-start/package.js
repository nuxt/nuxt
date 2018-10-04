export default (pkg, { load }) => {
  // Read nuxt package
  const nuxt = load('../../')
  const core = load('../nuxt-core')

  // Copy version before build for dist banner
  pkg.on('build:before', () => {
    pkg.copyFieldsFrom(nuxt, ['version'])
    pkg.writePackage()
  })

  pkg.on('build:done', () => {
    // Copy fields from nuxt package
    pkg.copyFieldsFrom(nuxt, [
      'contributors',
      'license',
      'repository',
      'keywords',
      'homepage',
      'engines'
    ])

    // Copy files from nuxt package
    pkg.copyFilesFrom(nuxt, [
      'LICENSE'
    ])

    // Copy files from nuxt-core package
    pkg.copyFilesFrom(core, [
      'bin/common',
      'bin/nuxt-start'
    ])

    // Sync dependencies
    pkg.updateDependencies({
      dist: 'dist/nuxt-start.js',
      sources: [nuxt],
      extras: [
        'minimist',
        'vue-no-ssr',
        'vue-router',
        'vuex'
      ],
      exclude: [
        'jsdom'
      ]
    })

    // Sort dependencies
    pkg.sortDependencies()

    // Update package.json
    pkg.writePackage()

    // Copy dist artifacts to nuxt
    core.copyFilesFrom(pkg, ['dist'])
  })
}
