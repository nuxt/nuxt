export default (pkg, { load }) => {
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
    'engines'
  ])

  // Copy files from nuxt package
  pkg.copyFilesFrom(nuxt, [
    'LICENSE.md',
    'bin/common',
    'bin/nuxt-start'
  ])

  // Update package.json
  pkg.writePackage()

  // After build hook
  pkg.on('build:done', () => {
    // Copy dist artifacts to nuxt
    nuxt.copyFilesFrom(pkg, ['dist'])

    // Sync dependencies
    pkg.updateDependencies({
      dist: 'dist/nuxt-start.js',
      sources: [nuxt],
      extras: [
        'minimist'
      ],
      exclude: [
        'jsdom'
      ]
    })

    // Update package.json
    pkg.writePackage()
  })
}
