import { joinURL, withoutFragment } from 'ufo'
import type { RouteLocationNormalized } from 'vue-router'

import { defineNuxtPlugin, useRuntimeConfig } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'
import { _loadPayload, isCachedPayloadRoute, isOutdatedPayload } from '../composables/payload'
import { reloadNuxtApp } from '../composables/chunk'
import { onNuxtReady } from '../composables/ready'
import { useRouter } from '../composables/router'
import { stateDiagnostics } from '../diagnostics/state'
import { usePrefetchScheduler } from '../internal/prefetch-scheduler'
import { prefetchGroup } from '../internal/prefetch-util'
import { documentURL } from '../internal/location'

import { payloadExtraction, prefetchPreloadTags, purgeCachedData } from '#build/nuxt.config.mjs'

type HintLink = Record<string, string | boolean>

/** Forwarded hint elements, mapped to the function that settles their prefetch task. */
const forwardedHints = new Map<HTMLLinkElement, () => void>()
const forwardedHintHrefs = new Set<string>()

const MAX_HINTS_PER_ROUTE = 2
const FORWARDED_HINT_TIMEOUT_MS = 30_000

function removeHint (el: HTMLLinkElement, complete: () => void) {
  complete()
  el.onload = el.onerror = null
  el.remove()
}

function disposeHint (el: HTMLLinkElement) {
  const complete = forwardedHints.get(el)
  if (complete) {
    forwardedHints.delete(el)
    removeHint(el, complete)
  }
}

function createHintElement (link: HintLink): HTMLLinkElement {
  const el = document.createElement('link')
  for (const [key, value] of Object.entries(link)) {
    if (value !== false && key !== 'id') {
      el.setAttribute(key, value === true ? '' : value)
    }
  }
  // a unique hydration key stops unhead adopting the element for one of its own tags
  el.setAttribute('data-hid', `nuxt-hint:${el.href}`)
  return el
}

function documentHrefs (): Set<string> {
  const hrefs = new Set<string>()
  for (const link of document.head.querySelectorAll('link[href]')) {
    hrefs.add((link as HTMLLinkElement).href)
  }
  return hrefs
}

interface SelectedHint { href: string, link: HintLink }

function selectHints (prefetchLinks: HintLink[]): SelectedHint[] {
  const existingHrefs = documentHrefs()
  const selected: SelectedHint[] = []

  for (const link of prefetchLinks) {
    if (selected.length >= MAX_HINTS_PER_ROUTE) { break }
    if (typeof link.href !== 'string') { continue }
    const href = new URL(link.href, document.baseURI).href
    if (existingHrefs.has(href) || forwardedHintHrefs.has(href)) { continue }
    forwardedHintHrefs.add(href)
    if (link.as === 'image') {
      // `rel="prefetch"` has no request destination, so image hints stay as
      // `rel="preload"`, with any `fetchpriority` dropped so that they
      // cannot outrank the current page
      const { fetchpriority: _fetchpriority, ...rest } = link
      selected.push({ href, link: rest })
    } else {
      // Downgrade preload (and modulepreload) to prefetch.
      const { rel: _rel, ...rest } = link
      selected.push({ href, link: { ...rest, rel: 'prefetch' } })
    }
  }

  return selected
}

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:payload',
  setup (nuxtApp) {
    if (!payloadExtraction) { return }

    // Load payload after middleware & once final route is resolved
    const staticKeysToRemove = new Set<string>()
    const router = useRouter()
    const config = useRuntimeConfig()
    const { schedule } = usePrefetchScheduler(nuxtApp)
    let outdatedBuildDetected = false
    let pendingNavigation: RouteLocationNormalized | undefined
    router.beforeEach((to) => { pendingNavigation = to })
    if (prefetchPreloadTags) {
      // Drop forwarded resource hints so they don't linger indefinitely, once the destination
      // page has rendered so that its own hints can reuse any in-flight requests.
      router.afterEach((_to, _from, failure) => {
        const stale = [...forwardedHints]
        forwardedHints.clear()
        forwardedHintHrefs.clear()
        if (!stale.length) { return }
        const removeStale = () => {
          for (const [el, complete] of stale) { removeHint(el, complete) }
        }
        if (failure) { return removeStale() }
        const unhook = nuxtApp.hooks.hookOnce('page:finish', () => {
          clearTimeout(timeout)
          // after the head's debounced DOM update, so that the page's own links are inserted first
          setTimeout(removeStale)
        })
        const timeout = setTimeout(() => {
          unhook()
          removeStale()
        }, FORWARDED_HINT_TIMEOUT_MS)
      })
    }
    router.beforeResolve(async (to, from) => {
      const queryAware = isCachedPayloadRoute(to.path)
      const toURL = queryAware ? withoutFragment(to.fullPath) : to.path
      const fromURL = queryAware ? withoutFragment(from.fullPath) : from.path
      if (toURL === fromURL) { return }
      const payload = await _loadPayload(toURL)
      if (!payload) { return }
      if (isOutdatedPayload(payload)) {
        if (pendingNavigation !== to) { return }
        reloadNuxtApp({ path: joinURL(config.app.baseURL, to.fullPath), persistState: true })
        return
      }
      if (purgeCachedData) {
        for (const key of staticKeysToRemove) {
          delete nuxtApp.static.data[key]
        }
        staticKeysToRemove.clear()
      }
      for (const key in payload.data) {
        if (purgeCachedData) {
          if (!Object.hasOwn(nuxtApp.static.data, key)) {
            staticKeysToRemove.add(key)
          }
        }
        nuxtApp.static.data[key] = payload.data[key]
      }
    })

    // Load payload into cache
    const forwardHint = (link: HintLink) => (signal: AbortSignal) => new Promise<void>((resolve) => {
      if (signal.aborted) { return resolve() }
      const el = createHintElement(link)
      const complete = () => {
        clearTimeout(timeout)
        signal.removeEventListener('abort', complete)
        resolve()
      }
      const fail = () => {
        complete()
        disposeHint(el)
      }
      signal.addEventListener('abort', complete)
      el.onerror = fail
      el.onload = complete
      const timeout = setTimeout(fail, FORWARDED_HINT_TIMEOUT_MS)

      forwardedHints.set(el, complete)
      document.head.appendChild(el)
    })

    nuxtApp.hooks.hook('link:prefetch', (url) => {
      onNuxtReady(() => {
        const documentLocation = documentURL()
        if (new URL(url, documentLocation).hostname !== documentLocation.hostname) { return }
        const group = prefetchGroup(url)
        schedule({
          key: `payload:${url}`,
          priority: 'payload',
          scope: 'navigation',
          group,
          run: async (signal, promoted) => {
            if (signal.aborted) { return }
            // TODO: use preloadPayload instead once we can support preloading islands too
            const payload = await _loadPayload(url, { signal, promoted }).catch(() => {
              stateDiagnostics.NUXT_E7003({ url })
            })
            if (payload && isOutdatedPayload(payload)) {
              if (!outdatedBuildDetected) {
                outdatedBuildDetected = true
                nuxtApp.callHook('app:manifest:update')
              }
              return
            }
            // a retained payload resolves onto its own route, which renders these hints itself
            if (signal.aborted || !prefetchPreloadTags || !payload?.prefetchLinks?.length || group === prefetchGroup(router.currentRoute.value.fullPath)) { return }
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
  },
})

export default plugin
