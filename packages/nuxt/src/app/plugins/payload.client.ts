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
import { usePrefetchScheduler } from '../internal/prefetch-scheduler'
import { canPrefetch, prefetchGroup } from '../internal/prefetch-util'

import { appManifest as isAppManifestEnabled, prefetchPreloadTags, purgeCachedData } from '#build/nuxt.config.mjs'

interface ActiveHeadEntryLike { dispose: () => void }

const forwardedHintEntries = new Set<ActiveHeadEntryLike>()
const forwardedHintHrefs = new Set<string>()

const MAX_HINTS_PER_ROUTE = 2
const FORWARDED_HINT_TIMEOUT_MS = 30_000

function disposeHint (entry: ActiveHeadEntryLike) {
  if (forwardedHintEntries.delete(entry)) {
    entry.dispose()
  }
}

function documentHrefs (): Set<string> {
  const hrefs = new Set<string>()
  for (const link of document.head.querySelectorAll('link[href]')) {
    hrefs.add((link as HTMLLinkElement).href)
  }
  return hrefs
}

interface SelectedHint { href: string, link: ResolvableLink }

function selectHints (prefetchLinks: Array<Record<string, string | boolean>>): SelectedHint[] {
  const existingHrefs = documentHrefs()
  const selected: SelectedHint[] = []

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
      selected.push({ href, link: rest as ResolvableLink })
    } else {
      // Downgrade preload (and modulepreload) to prefetch.
      const { rel: _rel, ...rest } = link
      selected.push({ href, link: { ...rest, rel: 'prefetch' } as ResolvableLink })
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
    const { schedule } = usePrefetchScheduler(nuxtApp)
    if (prefetchPreloadTags) {
      // Drop forwarded resource hints so they don't linger indefinitely.
      router.afterEach(() => {
        for (const entry of [...forwardedHintEntries]) {
          disposeHint(entry)
        }
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
    const forwardHint = (link: ResolvableLink) => (signal: AbortSignal) => new Promise<void>((resolve) => {
      if (signal.aborted) { return resolve() }
      const hint: { entry?: ActiveHeadEntryLike, timeout?: ReturnType<typeof setTimeout> } = {}
      const complete = (dispose: boolean) => {
        clearTimeout(hint.timeout)
        signal.removeEventListener('abort', onAbort)
        if (dispose && hint.entry) {
          disposeHint(hint.entry)
        }
        resolve()
      }
      const onAbort = () => complete(true)
      signal.addEventListener('abort', onAbort)

      hint.entry = head!.push({
        link: [{
          ...link,
          onerror: () => complete(true),
          onload: () => complete(false),
        }],
      })
      forwardedHintEntries.add(hint.entry)
      hint.timeout = setTimeout(() => complete(true), FORWARDED_HINT_TIMEOUT_MS)
    })

    nuxtApp.hooks.hook('link:prefetch', (url) => {
      onNuxtReady(() => {
        const { hostname } = new URL(url, window.location.href)
        if (hostname !== window.location.hostname) { return }
        const group = prefetchGroup(url)
        schedule({
          key: `payload:${url}`,
          priority: 'payload',
          scope: 'navigation',
          group,
          run: async (signal, promoted) => {
            if (signal.aborted) { return }
            // TODO: use preloadPayload instead once we can support preloading islands too
            const payload = await loadPayload(url, { signal, promoted }).catch(() => {
              stateDiagnostics.NUXT_E7003({ url })
            })
            // a retained payload resolves onto its own route, which renders these hints itself
            if (signal.aborted || !head || !payload?.prefetchLinks?.length || group === prefetchGroup(router.currentRoute.value.fullPath)) { return }
            schedule(selectHints(payload.prefetchLinks).map(({ href, link }) => ({
              key: `hint:${href}`,
              priority: 'hint',
              scope: 'navigation',
              group,
              run: forwardHint(link),
            })))
          },
        })
      })
    })

    onNuxtReady(() => {
      if (isAppManifestEnabled && canPrefetch()) {
        setTimeout(getAppManifest, 1000)
      }
    })
  },
})

export default plugin
