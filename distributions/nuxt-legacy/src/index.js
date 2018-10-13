import '@babel/polyfill'
import consola from 'consola'
import _Common from '@nuxtjs/common'

export * from '@nuxtjs/core'
export * from '@nuxtjs/builder'

export const Utils = _Common // Backward Compatibility
export const Options = _Common.Options // Backward Compatibility

consola.warn('You are using legacy build of Nuxt. Please consider upgrading your Node.js version to 8.x or later.')
