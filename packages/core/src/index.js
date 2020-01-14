import { loadNuxtConfig } from '@nuxt/config'
import Nuxt from './nuxt'

export { default as Module } from './module'
export { default as Nuxt } from './nuxt'
export { default as Resolver } from './resolver'
export { loadNuxtConfig } from '@nuxt/config'

export async function getNuxt (configOptions, autoReady = true) {
  const config = await loadNuxtConfig(configOptions)
  const nuxt = new Nuxt(config)
  if (autoReady) {
    await nuxt.ready()
  }
  return nuxt
}
