import consola from 'consola'

export default {
  test: true,
  mode: 'spa',
  hooks (hook) {
    hook('build:done', () => {
      consola.log('Compiled successfully')
    })
    hook('listen', (server, { port, host }) => {
      consola.log(`Listening on http://${host}:${port}`)
    })
  },
  build: {
    terser: false
  }
}
