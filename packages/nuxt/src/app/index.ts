/// <reference path="types/augments.d.ts" />

export * from './nuxt'
// eslint-disable-next-line import/no-restricted-paths
export * from './composables/index'
// eslint-disable-next-line import/no-restricted-paths
export * from './components/index'
export * from './config'
export * from './compat/idle-callback'

// eslint-disable-next-line import/no-restricted-paths
export type { PageMeta } from '../pages/runtime/index'

export const isVue2 = false
export const isVue3 = true

if (import.meta.dev) {
  console.log('Directly importing from `#app` is discouraged as it can decrease performance in Vite. Instead, you can import from `#imports`. You can read more at https://nuxt.com/docs/guide/concepts/auto-imports#explicit-imports.')
}
