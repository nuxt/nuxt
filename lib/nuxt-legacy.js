import '@babel/polyfill'
import consola from 'consola'
import * as Utils from './common/utils'

consola.warn('You are using legacy build of Nuxt. Please consider upgrading your Node.js version to 8.x or later.')

export { Utils }
export * from './core'
export * from './builder'
