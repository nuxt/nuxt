import consola from 'consola'

export default {
  test: true,
  buildDir: '.nuxt-generate/build',
  generate: {
    dir: '.nuxt-generate/generate'
  },
  hooks (hook) {
    hook('generate:done', (generator, errors) => {
      if (!errors || errors.length === 0) {
        consola.log('Generated successfully')
      } else {
        consola.log('Generated failed')
      }
    })
  },
  build: {
    terser: false
  }
}
