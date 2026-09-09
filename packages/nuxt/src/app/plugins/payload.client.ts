import { withoutFragment } from 'ufo'
import type { ResolvableLink } from 'unhead/types'

import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'
import { isCachedPayloadRoute, loadPayload } from '../composables/payload'
import { onNuxtReady } from '../composables/ready'
import { useRouter } from '../composables/router'
import { getAppManifest } from '../composables/manifest'
import { injectHead } from '../composables/head'
import { stateDiagnostics } from '../diagnostics/state'

import { appManifest as isAppManifestEnabled, prefetchPreloadTags, purgeCachedData } from '#build/nuxt.config.mjs'

interface ActiveHeadEntryLike { dispose: () => void }
interface ActiveForwardedHint { entry?: ActiveHeadEntryLike, timeout?: ReturnType<typeof setTimeout> }

// queued newest-first, so the most recently prefetched route is served next
const pendingForwardedHints: ResolvableLink[] = []
const activeForwardedHints = new Set<ActiveForwardedHint>()
const forwardedHintEntries = new Set<ActiveHeadEntryLike>()
const forwardedHintHrefs = new Set<string>()
// bumped on navigation, so payloads that resolve afterwards are discarded
let hintGeneration = 0

const MAX_HINTS_PER_ROUTE = 2
const MAX_CONCURRENT_FORWARDED_HINTS = 8
const FORWARDED_HINT_TIMEOUT_MS = 30_000

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

function selectHints (prefetchLinks: Array<Record<string, string | boolean>>): ResolvableLink[] {
  const existingHrefs = documentHrefs()
  const selected: ResolvableLink[] = []

  for (const link of prefetchLinks) {
    if (selected.length >= MAX_HINTS_PER_ROUTE) { break }
    if (typeof link.href !== 'string') { continue }
    const href = new URL(link.href, window.location.href).href
    if (existingHrefs.has(href) || forwardedHintHrefs.has(href)) { continue }
    forwardedHintHrefs.add(href)
    if (link.as === 'image') {
      // `rel="prefetch"` has no request destination, so image hints stay as
      // `rel="preload"`, with any `fetchpriority` dropped so that they
      // cannot outrank the current page
      const { fetchpriority: _fetchpriority, ...rest } = link
      selected.push(rest as ResolvableLink)
    } else {
      // Downgrade preload (and modulepreload) to prefetch.
      const { rel: _rel, ...rest } = link
      selected.push({ ...rest, rel: 'prefetch' } as ResolvableLink)
    }
  }

  return selected
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
        pendingForwardedHints.length = 0
        for (const hint of activeForwardedHints) {
          clearTimeout(hint.timeout)
        }
        activeForwardedHints.clear()
        for (const entry of forwardedHintEntries) {
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
    const drainForwardedHints = () => {
      if (!head) { return }
      while (activeForwardedHints.size < MAX_CONCURRENT_FORWARDED_HINTS && pendingForwardedHints.length) {
        const link = pendingForwardedHints.shift()!
        const hint: ActiveForwardedHint = {}
        const complete = (dispose: boolean) => {
          // a stale hint has already been removed (and disposed) on navigation
          if (!activeForwardedHints.delete(hint)) { return }
          clearTimeout(hint.timeout)
          if (dispose && hint.entry) {
            hint.entry.dispose()
            forwardedHintEntries.delete(hint.entry)
          }
          drainForwardedHints()
        }

        activeForwardedHints.add(hint)
        hint.entry = head.push({
          link: [{
            ...link,
            onerror: () => complete(true),
            onload: () => complete(false),
          }],
        })
        forwardedHintEntries.add(hint.entry)
        hint.timeout = setTimeout(() => complete(true), FORWARDED_HINT_TIMEOUT_MS)
      }
    }

    nuxtApp.hooks.hook('link:prefetch', (url) => {
      onNuxtReady(async () => {
        const generation = hintGeneration
        const { hostname } = new URL(url, window.location.href)
        if (hostname !== window.location.hostname) { return }
        // TODO: use preloadPayload instead once we can support preloading islands too
        const payload = await loadPayload(url).catch(() => {
          stateDiagnostics.NUXT_E7003({ url })
        })
        if (head && generation === hintGeneration && payload?.prefetchLinks?.length && canAffordHints()) {
          const selected = selectHints(payload.prefetchLinks)
          if (!selected.length) { return }
          pendingForwardedHints.unshift(...selected)
          drainForwardedHints()
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
