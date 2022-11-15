/// <reference path="types/augments.d.ts" />

export * from './nuxt'
export * from './composables'
export * from './components'
export * from './config'

// eslint-disable-next-line import/no-restricted-paths
export type { PageMeta } from '../pages/runtime'
// eslint-disable-next-line import/no-restricted-paths
export type { MetaObject } from '../head/runtime'
// eslint-disable-next-line import/no-restricted-paths
export { useHead } from '#head'

export const isVue2 = false
export const isVue3 = true
