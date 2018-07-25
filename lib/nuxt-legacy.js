import 'babel-polyfill'
import consola from 'consola'

consola.warn('You are using legacy build of Nuxt. Please consider upgrading your Node.js version to 8.x or later.')

export * from './core'
export * from './builder'
export * from './common/utils'
