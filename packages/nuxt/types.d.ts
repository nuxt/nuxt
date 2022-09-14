/// <reference types="nitropack" />
export * from './dist/index'

declare global {
  const defineNuxtConfig: typeof import('nuxt/config')['defineNuxtConfig']
}
