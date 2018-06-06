import consola from 'consola'

export default {
  hooks(hook) {
    hook('build:done', builder => {
      consola.success('Compiled successfully')
    })
    hook('listen', (server, { port, host }) => {
      consola.success(`Listening on http://${host}:${port}`)
    })
  }
}
