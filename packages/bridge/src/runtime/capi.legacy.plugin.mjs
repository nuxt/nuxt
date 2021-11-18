import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp._setupFns = []

  const _originalSetup = nuxtApp.nuxt2Context.app.setup

  nuxtApp.nuxt2Context.app.setup = function (...args) {
    const result = _originalSetup instanceof Function ? _originalSetup(...args) : {}
    for (const fn of nuxtApp._setupFns) {
      Object.assign(result, fn.call(this, ...args))
    }
    return result
  }
})
