import { withoutFragment } from 'ufo'

import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'
import { isCachedPayloadRoute, loadPayload } from '../composables/payload'
import { onNuxtReady } from '../composables/ready'
import { useRouter } from '../composables/router'
import { getAppManifest } from '../composables/manifest'
import { injectHead } from '../composables/head'
import { stateDiagnostics } from '../diagnostics/state'

import { appManifest as isAppManifestEnabled, prefetchPreloadTags, purgeCachedData } from '#build/nuxt.config.mjs'

// track the active head entry per path for forwarded preload hints
interface ActiveHeadEntryLike { dispose: () => void }
const forwardedHintEntries = new Map<string, ActiveHeadEntryLike>()
const forwardedHintHrefs = new Set<string>()
// bumped on navigation, so payloads that resolve afterwards are discarded
let hintGeneration = 0
let forwardedHintCount = 0

const MAX_HINTS_PER_ROUTE = 2
const MAX_FORWARDED_HINTS = 8

const SLOW_CONNECTION_TYPES = new Set(['slow-2g', '2g'])

// `navigator.connection` is not part of the standard TS DOM lib
interface NetworkInformationLike { saveData?: boolean, effectiveType?: string }
type NavigatorWithConnection = Navigator & { connection?: NetworkInformationLike }

function canAffordHints (): boolean {
  const connection = (navigator as NavigatorWithConnection).connection
  if (!connection) { return true }
  return !connection.saveData && !SLOW_CONNECTION_TYPES.has(connection.effectiveType!)
}

function documentHrefs (): Set<string> {
  const hrefs = new Set<string>()
  for (const link of document.head.querySelectorAll('link[href]')) {
    hrefs.add((link as HTMLLinkElement).href)
  }
  return hrefs
}

function selectHints (prefetchLinks: Array<Record<string, string | boolean>>): Array<Record<string, string | boolean>> {
  const existingHrefs = documentHrefs()
  const links: Array<Record<string, string | boolean>> = []

  for (const link of prefetchLinks) {
    if (links.length >= MAX_HINTS_PER_ROUTE || forwardedHintCount + links.length >= MAX_FORWARDED_HINTS) { break }
    if (typeof link.href !== 'string') { continue }
    const href = new URL(link.href, window.location.href).href
    if (existingHrefs.has(href) || forwardedHintHrefs.has(href)) { continue }
    forwardedHintHrefs.add(href)

    if (link.as === 'image') {
      // `rel="prefetch"` has no request destination, so image hints stay as
      // `rel="preload"`, with any `fetchpriority` dropped so that they cannot
      // outrank the current page
      const { fetchpriority: _fetchpriority, ...rest } = link
      links.push(rest)
      continue
    }

    const { rel: _rel, ...rest } = link
    links.push({ ...rest, rel: 'prefetch' })
  }

  return links
}

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:payload',
  setup (nuxtApp) {
    // Load payload after middleware & once final route is resolved
    const staticKeysToRemove = new Set<string>()
    const router = useRouter()
    if (prefetchPreloadTags) {
      // Drop forwarded resource hints so they don't linger indefinitely.
      router.afterEach(() => {
        hintGeneration++
        forwardedHintCount = 0
        for (const entry of forwardedHintEntries.values()) {
          entry.dispose()
        }
        forwardedHintEntries.clear()
        forwardedHintHrefs.clear()
      })
    }
    router.beforeResolve(async (to, from) => {
      const queryAware = isCachedPayloadRoute(to.path)
      const toURL = queryAware ? withoutFragment(to.fullPath) : to.path
      const fromURL = queryAware ? withoutFragment(from.fullPath) : from.path
      if (toURL === fromURL) { return }
      const payload = await loadPayload(toURL)
      if (!payload) { return }
      if (purgeCachedData) {
        for (const key of staticKeysToRemove) {
          delete nuxtApp.static.data[key]
        }
      }
      for (const key in payload.data) {
        if (purgeCachedData) {
          if (!(key in nuxtApp.static.data)) {
            staticKeysToRemove.add(key)
          }
        }
        nuxtApp.static.data[key] = payload.data[key]
      }
    })

    // Load payload into cache
    const head = prefetchPreloadTags ? injectHead(nuxtApp) : null
    nuxtApp.hooks.hook('link:prefetch', (url) => {
      onNuxtReady(async () => {
        const generation = hintGeneration
        const { hostname, pathname } = new URL(url, window.location.href)
        if (hostname !== window.location.hostname) { return }
        // TODO: use preloadPayload instead once we can support preloading islands too
        const payload = await loadPayload(url).catch(() => {
          stateDiagnostics.NUXT_E7003({ url })
        })
        if (head && generation === hintGeneration && payload?.prefetchLinks?.length && !forwardedHintEntries.has(pathname) && canAffordHints()) {
          const links = selectHints(payload.prefetchLinks)
          if (!links.length) { return }
          forwardedHintCount += links.length
          forwardedHintEntries.set(pathname, head.push({ link: links }))
        }
      })
    })

    onNuxtReady(() => {
      if (isAppManifestEnabled && (navigator as NavigatorWithConnection).connection?.effectiveType !== 'slow-2g') {
        setTimeout(getAppManifest, 1000)
      }
    })
  },
})

export default plugin
