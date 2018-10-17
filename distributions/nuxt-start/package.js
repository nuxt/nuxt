export default {
  build: true,
  linkedDependencies: [
    '@nuxt/cli',
    '@nuxt/common',
    '@nuxt/core'
  ],
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
        'engines'
      ])

      pkg.writePackage()
    })
  }
}
