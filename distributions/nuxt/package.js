export default (pkg, { load }) => {
  const mono = load('../..')

  pkg.on('build:done', () => {
    // Copy files from mono package
    pkg.copyFilesFrom(mono, [
      'LICENSE'
    ])

    // Sort dependencies
    pkg.sortDependencies()

    // Update package.json
    pkg.writePackage()
  })
}
