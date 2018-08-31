export default (pkg, { load }) => {
  pkg.on('build:done', () => {
    // Read nuxt package
    const nuxt = load('../..')

    // Copy fields from nuxt package
    pkg.copyFieldsFrom(nuxt, [
      'version',
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
      'LICENSE.md',
      'bin'
    ])

    // Update package.json
    pkg.writePackage()

    // Copy dist artifacts to nuxt
    nuxt.copyFilesFrom(pkg, [ 'dist' ])
  })
}
