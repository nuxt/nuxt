export default (pkg, { load }) => {
  // Read nuxt package
  const nuxt = load('nuxt')
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
      'engines',
      'dependencies'
    ])

    // Copy files from nuxt package
    pkg.copyFilesFrom(nuxt, [
      'LICENSE'
    ])

    // Copy files from nuxt-core package
    pkg.copyFilesFrom(core, [
      'bin'
    ])

    // Sort dependencies
    pkg.sortDependencies()

    // Update package.json
    pkg.writePackage()

    // Copy dist artifacts to nuxt
    core.copyFilesFrom(pkg, [ 'dist' ])
  })
}
