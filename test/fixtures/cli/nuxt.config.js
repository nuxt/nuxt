import consola from 'consola'

export default {
  hooks(hook) {
    hook('build:done', builder => {
      consola.success('Compiled successfully')
    })
    hook('generate:done', (generator, errors) => {
      if (!errors || errors.length === 0) {
        consola.success('Generated successfully')
      } else {
        consola.error('Generated failed')
      }
    })
    hook('listen', (server, { port, host }) => {
      consola.success(`Listening on http://${host}:${port}`)
    })
  },
  generate: {
    dir: '.nuxt-generate'
  }
}
