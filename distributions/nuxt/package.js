export default {
  build: true,
  extend(pkg, { load }) {
    pkg.on('build:done', () => {
      const mono = load('../..')
      const core = load('../../packages/core')

      pkg.copyFilesFrom(mono, [
        'LICENSE'
      ])

      pkg.copyFilesFrom(core, [
        'bin'
      ])
    })
  }
}
