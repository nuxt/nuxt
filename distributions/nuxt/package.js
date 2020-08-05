export default {
  build: true,
  hooks: {
    async 'build:done' (pkg) {
      const mono = pkg.load('../..')

      await pkg.copyFilesFrom(mono, [
        'LICENSE',
        'README.md'
      ])
    }
  }
}
