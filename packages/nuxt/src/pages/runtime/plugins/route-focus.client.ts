import { START_LOCATION } from 'vue-router'
import { defineNuxtPlugin } from '#app/nuxt'
import type { ObjectPlugin, Plugin } from '#app/nuxt'
import { useRouter } from '#app/composables/router'
import { appResetFocus as defaultResetFocus } from '#build/nuxt.config.mjs'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:route-focus',
  setup (nuxtApp) {
    const router = useRouter()

    let cancelPending: (() => void) | undefined

    router.afterEach((to, from, failure) => {
      // A later navigation supersedes any focus reset we were still waiting to apply
      cancelPending?.()
      cancelPending = undefined

      if (failure || from === START_LOCATION || nuxtApp.isHydrating) { return }

      // Hash and query changes on the same page are not a new document
      if (to.path.replace(/\/$/, '') === from.path.replace(/\/$/, '')) { return }

      const routeAllowsResetFocus = typeof to.meta.resetFocus === 'function' ? to.meta.resetFocus(to, from) : to.meta.resetFocus
      if (!(routeAllowsResetFocus ?? defaultResetFocus)) { return }

      const activeElementOnNavigation = document.activeElement

      let canceled = false
      const resetFocus = () => {
        requestAnimationFrame(() => {
          if (canceled || router.currentRoute.value.fullPath !== to.fullPath) { return }

          // Respect focus that was moved on purpose while the page was rendering
          const activeElement = document.activeElement
          if (activeElement && activeElement !== document.body && activeElement !== activeElementOnNavigation) { return }

          _resetFocus(to.hash)
        })
      }

      // Wait for the new page to be rendered (and for the old one to have left)
      const unhook = nuxtApp.hooks.hookOnce('page:loading:end', () => {
        const transitionPromise = nuxtApp['~transitionPromise'] as Promise<void> | undefined
        if (transitionPromise) {
          transitionPromise.then(resetFocus)
        } else {
          resetFocus()
        }
      })

      cancelPending = () => {
        canceled = true
        unhook()
      }
    })
  },
})

export default plugin

/**
 * Move focus to where the browser would leave it after loading a new document:
 * an `autofocus` element, the URL fragment target, or else the start of the document.
 */
function _resetFocus (hash: string) {
  const target = document.querySelector<HTMLElement>('[autofocus]') || _getHashElement(hash) || document.body

  // Elements that can't normally be focused (like `<body>`) only need to be focusable for the
  // duration of the call: they don't stay focused, but the next <kbd>Tab</kbd> continues from them.
  const tabindex = target.getAttribute('tabindex')
  const isFocusable = target.tabIndex >= 0 || tabindex !== null
  if (!isFocusable) {
    target.setAttribute('tabindex', '-1')
  }

  target.focus({ preventScroll: true, focusVisible: false })

  if (!isFocusable) {
    target.removeAttribute('tabindex')
  }
}

function _getHashElement (hash: string): HTMLElement | null {
  if (!hash) { return null }
  let id = hash.slice(1)
  try {
    id = decodeURIComponent(id)
  } catch {
    // ignore errors
  }
  return document.getElementById(id)
}
