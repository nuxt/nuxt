export default {
  build: false,
  extend(pkg, { load }) {
    pkg.on('build:done', () => {
      const mono = load('../..')
      const nuxt = load('../nuxt')

      pkg.copyFilesFrom(mono, [
        'LICENSE'
      ])

      pkg.copyFieldsFrom(nuxt, [
        'license',
        'repository',
        'contributors',
        'keywords',
        'collective'
      ])

      pkg.writePackage()
    })
  }
}
