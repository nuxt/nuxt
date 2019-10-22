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
  }
}
