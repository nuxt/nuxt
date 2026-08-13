import { isChangingPage } from '../components/utils'
import { useRouter } from '../composables/router'
import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'
import type { ViewTransitionPageOptions } from 'nuxt/schema'
import { cancelPendingViewTransition, createPendingViewTransition, supersedePendingViewTransition } from '../view-transitions'
import { appViewTransition as defaultViewTransition } from '#build/nuxt.config.mjs'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin((nuxtApp) => {
  if (!document.startViewTransition) {
    return
  }

  let hasUAVisualTransition = false

  const resetTransitionState = () => {
    delete nuxtApp._pendingViewTransition
  }

  const cancelTransition = () => {
    const session = nuxtApp._pendingViewTransition
    if (session) {
      cancelPendingViewTransition(session)
    }
    resetTransitionState()
  }

  window.addEventListener('popstate', (event) => {
    hasUAVisualTransition = event.hasUAVisualTransition
    if (hasUAVisualTransition) {
      cancelTransition()
    }
  })

  const router = useRouter()

  const normalizeViewTransitionOptions = (value: unknown): Partial<ViewTransitionPageOptions> => {
    if (typeof value === 'boolean' || value === 'always') {
      return { enabled: value }
    }
    if (value && typeof value === 'object') {
      return value as ViewTransitionPageOptions
    }
    return {}
  }

  router.beforeResolve(async (to, from) => {
    const previousSession = nuxtApp._pendingViewTransition
    let supersededSession: typeof previousSession
    if (previousSession) {
      if (previousSession.status === 'claimed' || previousSession.status === 'preparing' || previousSession.status === 'ready') {
        supersedePendingViewTransition(previousSession)
        supersededSession = previousSession
      } else if (previousSession.status === 'armed') {
        // NuxtPage never claimed it, so discard the session instead of superseding.
        cancelTransition()
      } else if (previousSession.status === 'committing') {
        // wait for the browser to commit the previous session before starting a new one
        await previousSession.committed
      }
      resetTransitionState()
    }

    if (to.matched.length === 0) {
      hasUAVisualTransition = false
      return
    }

    const toViewTransitionOptions = normalizeViewTransitionOptions(to.meta.viewTransition)
    const fromViewTransitionOptions = normalizeViewTransitionOptions(from.meta.viewTransition)
    const viewTransitionMode = toViewTransitionOptions.enabled ?? defaultViewTransition.enabled
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const prefersNoTransition = prefersReducedMotion && viewTransitionMode !== 'always'

    if (
      viewTransitionMode === false ||
      prefersNoTransition ||
      hasUAVisualTransition ||
      !isChangingPage(to, from) ||
      // Skip when the layout changes as view transitions only support page swaps for now
      to.meta.layout !== from.meta.layout
    ) {
      hasUAVisualTransition = false
      return
    }

    const resolveViewTransitionTypes = (types: ViewTransitionPageOptions['types']) => {
      return types ? typeof types === 'function' ? types(to, from) : types : undefined
    }

    const viewTransitionBaseTypes =
      resolveViewTransitionTypes(toViewTransitionOptions.types) ??
      resolveViewTransitionTypes(defaultViewTransition.types) ??
      []
    const viewTransitionFromTypes = resolveViewTransitionTypes(fromViewTransitionOptions.fromTypes) ?? []
    const viewTransitionToTypes = resolveViewTransitionTypes(toViewTransitionOptions.toTypes) ?? []
    const session = createPendingViewTransition(to, from, [
      ...viewTransitionBaseTypes,
      ...viewTransitionFromTypes,
      ...viewTransitionToTypes,
    ])
    if (supersededSession) {
      session.superseded = [supersededSession]
    }

    session.start = () => {
      if (nuxtApp._pendingViewTransition !== session || session.status !== 'ready') {
        return
      }

      try {
        const update = async () => {
          if (session.status === 'cancelled') { return }
          session.status = 'committing'
          session.resolveGate()
          await session.committed
        }
        session.transition = session.types.length > 0
          ? document.startViewTransition!({ update, types: session.types })
          : document.startViewTransition!(update)

        // Existing consumers can still customize or skip the native transition.
        void nuxtApp.callHook('page:view-transition:start', session.transition)
        session.transition.ready.catch(() => {})
        session.transition.finished.catch(() => {}).finally(() => {
          session.status = 'finished'
        })
      } catch {
        // commit the staged branch if the browser rejects starting a transition
        session.status = 'committing'
        session.resolveGate()
      }
    }

    nuxtApp._pendingViewTransition = session
  })

  router.onError(cancelTransition)
  nuxtApp.hook('app:error', cancelTransition)
  nuxtApp.hook('vue:error', cancelTransition)
})

export default plugin
