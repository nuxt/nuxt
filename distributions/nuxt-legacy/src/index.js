import '@babel/polyfill'
import consola from 'consola'

export * from '@nuxtjs/core'
export * from '@nuxtjs/builder'

consola.warn('You are using legacy build of Nuxt. Please consider upgrading your Node.js version to 8.x or later.')
