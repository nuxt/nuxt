export default {
  build: true,
  extend(pkg, { load }) {
    pkg.on('build:done', () => {
      const mono = load('../..')

      pkg.copyFilesFrom(mono, [
        'LICENSE'
      ])
    })
  }
}
