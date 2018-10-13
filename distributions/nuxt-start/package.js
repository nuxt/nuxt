export default {
  extend(pkg, { load }) {
    pkg.on('build:done', () => {
      const mono = load('../..')
      const core = load('../../packages/core')
      const nuxt = load('../nuxt')

      pkg.copyFilesFrom(mono, [
        'LICENSE'
      ])

      pkg.copyFilesFrom(core, [
        'bin/nuxt-start'
      ])

      pkg.copyFieldsFrom(nuxt, [
        'version',
        'license',
        'repository',
        'contributors',
        'keywords',
        'collective',
        'engines',
        'dependencies'
      ])

      pkg.writePackage()
    })
  }
}
