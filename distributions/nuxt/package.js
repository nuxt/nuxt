export default {
  build: true,
  linkedDependencies: [
    '@nuxt/builder',
    '@nuxt/cli',
    '@nuxt/common',
    '@nuxt/core'
  ],
  extend(pkg, { load }) {
    pkg.on('build:done', () => {
      const mono = load('../..')

      pkg.copyFilesFrom(mono, [
        'LICENSE'
      ])
    })
  }
}
