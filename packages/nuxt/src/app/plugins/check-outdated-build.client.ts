import type { NuxtAppManifestMeta } from '#app'
import { defineNuxtPlugin, getAppManifest, onNuxtReady } from '#app'
// @ts-expect-error virtual file
import { buildAssetsURL } from '#build/paths.mjs'

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.test) { return }

  let timeout: NodeJS.Timeout

  async function getLatestManifest () {
    const currentManifest = await getAppManifest()
    if (timeout) { clearTimeout(timeout) }
    timeout = setTimeout(getLatestManifest, 1000 * 60 * 60)
    const meta = await $fetch<NuxtAppManifestMeta>(buildAssetsURL('builds/latest.json'))
    if (meta.id !== currentManifest.id) {
      // There is a newer build which we will let the user handle
      nuxtApp.hooks.callHook('app:manifest:update', meta)
    }
  }

  onNuxtReady(() => { timeout = setTimeout(getLatestManifest, 1000 * 60 * 60) })
})
