/// <reference path="types/augments.d.ts" />

export * from './nuxt'
// eslint-disable-next-line import/no-restricted-paths
export * from './composables/index'
// eslint-disable-next-line import/no-restricted-paths
export * from './components/index'
export * from './config'
export * from './compat/idle-callback'
export * from './types'

export const isVue2 = false
export const isVue3 = true
