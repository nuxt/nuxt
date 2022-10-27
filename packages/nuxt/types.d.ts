/// <reference types="nitropack" />
export * from './dist/index'

declare global {
  const defineNuxtConfig: typeof import('nuxt/config')['defineNuxtConfig']
}

declare module 'nitropack' {
  interface NitroRouteConfig {
    ssr?: boolean
  }
  interface NitroRouteRules {
    ssr?: boolean
  }
}
