import consola from 'consola'
import generate from './generate'

export default {
  ...generate,
  run (...args) {
    consola.warn('`nuxt export` has been deprecatrd! Please use `nuxt generate`.')
    generate.run.call(this, ...args)
  }
}
