import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxt) => {
  nuxt._setupFns = []

  const _originalSetup = nuxt.legacyNuxt.setup

  nuxt.legacyNuxt.setup = function (...args) {
    const result = _originalSetup instanceof Function ? _originalSetup(...args) : {}
    for (const fn of nuxt._setupFns) {
      Object.assign(result, fn.call(this, ...args))
    }
    return result
  }
})
