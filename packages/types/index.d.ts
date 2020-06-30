import '@nuxt/components'
import '@nuxt/telemetry'
import './process'

/**
 * Note: `export * from './app'` does not work well with TypeScript < 3.9
 * TODO: When 3.9 considered stable with Nuxt, require it and use `export *`
 */

export { Context, Middleware, NuxtAppOptions, NuxtError, Plugin, Transition } from './app'
export { Configuration, Module, NuxtConfig, NuxtOptions, ServerMiddleware } from './config'
