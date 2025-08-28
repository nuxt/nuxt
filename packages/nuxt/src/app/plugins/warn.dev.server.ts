import { defineNuxtPlugin } from '../nuxt'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.warnHandler ??= (msg, _instance, trace) => {
    console.warn(`[Vue warn]: ${msg}`, trace)
  }
})
