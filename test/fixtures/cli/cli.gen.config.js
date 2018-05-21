import consola from 'consola'

export default {
  buildDir: '.nuxt-generate/.build',
  generate: {
    dir: '.nuxt-generate/.generate'
  },
  hooks(hook) {
    hook('generate:done', (generator, errors) => {
      if (!errors || errors.length === 0) {
        consola.success('Generated successfully')
      } else {
        consola.error('Generated failed')
      }
    })
  }
}
