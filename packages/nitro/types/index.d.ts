import './shims'
import { NitroInput } from '../dist'

declare module '@nuxt/schema' {
  interface NuxtConfig {
    nitro?: NitroInput
  }
}

export * from './fetch'
export * from '../dist'
