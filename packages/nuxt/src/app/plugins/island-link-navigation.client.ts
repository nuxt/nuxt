import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'
import { useRouter } from '../composables/router'
import { onNuxtReady } from '../composables/ready'
import { preloadRouteComponents } from '../composables/preload'
import { isSlowConnection, useObserver } from '../components/nuxt-link'

import { componentIslands } from '#build/nuxt.config.mjs'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:island-link-navigation',
  setup (nuxtApp) {
    if (!componentIslands) { return }

    const router = useRouter()

    function resolveInternalLink (anchor: HTMLAnchorElement) {
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) { return }

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) { return }

      let path = url.pathname
      const base = (router.options.history.base || '').replace(/\/$/, '')
      if (base) {
        if (path === base) {
          path = '/'
        } else if (path.startsWith(base + '/')) {
          path = path.slice(base.length)
        } else {
          return
        }
      }

      const route = router.resolve(path + url.search + url.hash)
      if (route.matched.length) { return route }
    }

    function onClick (e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) { return }

      const anchor = (e.target as Element | null)?.closest('a')
      if (!anchor || !anchor.hasAttribute('data-internal') || anchor.hasAttribute('download')) { return }

      const route = resolveInternalLink(anchor)
      if (!route) { return }

      e.preventDefault()
      if (anchor.getAttribute('data-internal')!.split(' ').includes('replace')) {
        router.replace(route.fullPath)
      } else {
        router.push(route.fullPath)
      }
    }

    document.addEventListener('click', onClick)

    if (isSlowConnection()) { return }

    const unobservers = new Map<Element, () => void>()

    function observeAnchors (root: Element) {
      const observer = useObserver()
      if (!observer) { return }

      const selector = 'a[data-internal~="prefetch"]'
      const anchors = [...root.querySelectorAll<HTMLAnchorElement>(selector)]
      if (root.matches(selector)) { anchors.push(root as HTMLAnchorElement) }

      for (const anchor of anchors) {
        if (unobservers.has(anchor)) { continue }
        const unobserve = observer.observe(anchor, () => {
          unobservers.get(anchor)?.()
          unobservers.delete(anchor)
          const route = resolveInternalLink(anchor)
          if (!route) { return }
          nuxtApp.hooks.callHook('link:prefetch', route.fullPath)?.catch(() => {})
          if (!import.meta.dev) {
            preloadRouteComponents(route.fullPath, router).catch(() => {})
          }
        })
        unobservers.set(anchor, unobserve)
      }
    }

    function unobserveAnchors (root: Element) {
      for (const [anchor, unobserve] of unobservers) {
        if (root.contains(anchor)) {
          unobserve()
          unobservers.delete(anchor)
        }
      }
    }

    onNuxtReady(() => {
      observeAnchors(document.body)
      const mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.removedNodes) {
            if (node.nodeType === 1) { unobserveAnchors(node as Element) }
          }
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) { observeAnchors(node as Element) }
          }
        }
      })
      mutationObserver.observe(document.body, { childList: true, subtree: true })
    })
  },
})

export default plugin
