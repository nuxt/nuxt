import consola from 'consola'
import start from './start'

export default {
  ...start,
  run (...args) {
    consola.warn('`nuxt serve` has been deprecated! Please use `nuxt start`.')
    return start.run.call(this, ...args)
  }
}
