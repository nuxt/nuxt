import './shims'

declare module '@nuxt/schema' {
  import type { NitroInput } from '../dist'
  interface NuxtConfig {
    nitro?: NitroInput
  }
}

export * from './fetch'
export * from '../dist'
