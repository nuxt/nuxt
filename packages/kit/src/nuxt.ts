import { getContext } from 'unctx'
import type { Nuxt } from './types/nuxt'
import type { NuxtConfig } from './types/config'

export const nuxtCtx = getContext<Nuxt>('nuxt')
export const useNuxt = nuxtCtx.use

export function defineNuxtConfig (config: NuxtConfig) {
  return config
}
