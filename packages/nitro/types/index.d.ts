import './shims'
import { NitroInput } from '../dist'

declare module '@nuxt/kit' {
  interface NuxtConfig {
    nitro?: NitroInput
  }
}

declare module '@nuxt/types' {
  interface NuxtConfig {
    nitro?: NitroInput
  }
}

export * from '../dist'
