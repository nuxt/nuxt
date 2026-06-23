import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.warnHandler ??= (msg, _instance, trace) => {
    console.warn(`[Vue warn]: ${msg}`, trace)
  }
})

export default plugin
