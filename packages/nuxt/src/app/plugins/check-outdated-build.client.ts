import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'
import { checkForAppUpdate } from '../composables/manifest'
import { onNuxtReady } from '../composables/ready'
import { outdatedBuildInterval } from '#build/nuxt.config.mjs'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin((nuxtApp) => {
  if (import.meta.test) { return }

  let timeout: ReturnType<typeof setTimeout>
  let outdated = false

  nuxtApp.hooks.hookOnce('app:manifest:update', () => {
    outdated = true
    clearTimeout(timeout)
  })

  async function getLatestManifest () {
    try {
      await nuxtApp.runWithContext(() => checkForAppUpdate())
    } catch {
      // Retry on the next interval if the current manifest cannot be loaded.
    }
    if (!outdated) {
      timeout = setTimeout(getLatestManifest, outdatedBuildInterval)
    }
  }

  onNuxtReady(() => {
    if (!outdated) {
      timeout = setTimeout(getLatestManifest, outdatedBuildInterval)
    }
  })
})

export default plugin
