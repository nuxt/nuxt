import { loadNuxtConfig } from '@nuxt/config'
import Nuxt from './nuxt'

export { default as Module } from './module'
export { default as Nuxt } from './nuxt'
export { default as Resolver } from './resolver'

export function getNuxt (configOptions, autoReady = true) {
  const nuxt = new Nuxt(loadNuxtConfig(configOptions), autoReady)
  return autoReady ? nuxt.ready() : Promise.resolve(nuxt)
}
