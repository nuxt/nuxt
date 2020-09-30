import consola from 'consola'
import generate from './generate'

export default {
  ...generate,
  run (...args) {
    consola.warn('`nuxt export` has been deprecated! Please use `nuxt generate`.')
    return generate.run.call(this, ...args)
  }
}
