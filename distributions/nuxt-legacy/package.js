export default {
  build: false,
  hooks: {
    async 'build:done'(pkg) {
      const mono = pkg.load('../..')
      const nuxt = pkg.load('../nuxt')

      await pkg.copyFilesFrom(mono, [
        'LICENSE'
      ])

      await pkg.copyFieldsFrom(nuxt, [
        'license',
        'repository',
        'contributors',
        'keywords',
        'collective'
      ])

      await pkg.writePackage()
    }
  }
}
