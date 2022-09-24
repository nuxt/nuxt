import escapeRE from 'escape-string-regexp'
import { defineNuxtPlugin, loadPayload, useRouter } from '#app'

export default defineNuxtPlugin(async (nuxtApp) => {
  const manifest = await $fetch<{ static: string[] }>('/manifest.json', {
    cache: 'no-cache'
  }).catch(() => ({ static: [] }))

  nuxtApp._manifest = {
    ...manifest,
    static: manifest.static.map(r => r.endsWith('/**') ? new RegExp(escapeRE(r.slice(0, -3)) + '.*') : r)
  }

  if (nuxtApp._manifest.static.length === 0) { return }

  // Load payload into cache
  nuxtApp.hooks.hook('link:prefetch', to => loadPayload(to))

  // Load payload after middleware & once final route is resolved
  useRouter().beforeResolve(async (to, from) => {
    if (to.path === from.path) { return }
    const payload = await loadPayload(to.path)
    if (!payload) { return }
    Object.assign(nuxtApp.payload.data, payload.data)
  })
})
