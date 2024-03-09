import consola from 'consola'

export default {
  target: 'static',
  hooks (hook) {
    hook('generate:done', (generator, errors) => {
      if (!errors || errors.length === 0) {
        consola.log('Generated successfully')
      } else {
        consola.log('Generated failed')
      }
    })
  },
  generate: {
    cache: false
  }
}
