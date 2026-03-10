import { isChangingPage } from '../components/utils'
import { useRouter } from '../composables/router'
import { defineNuxtPlugin } from '../nuxt'
import type { ViewTransitionPageOptions } from 'nuxt/schema'
// @ts-expect-error virtual file
import { appViewTransition as defaultViewTransition } from '#build/nuxt.config.mjs'

export default defineNuxtPlugin((nuxtApp) => {
  if (!document.startViewTransition) {
    return
  }

  let transition: undefined | ViewTransition
  let hasUAVisualTransition = false
  let finishTransition: undefined | (() => void)
  let abortTransition: undefined | (() => void)

  const resetTransitionState = () => {
    transition = undefined
    hasUAVisualTransition = false
    abortTransition = undefined
    finishTransition = undefined
  }

  window.addEventListener('popstate', (event) => {
    hasUAVisualTransition = event.hasUAVisualTransition
    if (hasUAVisualTransition) { transition?.skipTransition() }
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
    if (to.matched.length === 0) { return }

    const toViewTransitionOptions = normalizeViewTransitionOptions(to.meta.viewTransition)
    const fromViewTransitionOptions = normalizeViewTransitionOptions(from.meta.viewTransition)
    const viewTransitionMode = toViewTransitionOptions.enabled ?? defaultViewTransition.enabled
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const prefersNoTransition = prefersReducedMotion && viewTransitionMode !== 'always'

    if (
      viewTransitionMode === false ||
      prefersNoTransition ||
      hasUAVisualTransition ||
      !isChangingPage(to, from)
    ) {
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

    const allTypes = [
      ...viewTransitionBaseTypes,
      ...viewTransitionFromTypes,
      ...viewTransitionToTypes,
    ]

    const promise = new Promise<void>((resolve, reject) => {
      finishTransition = resolve
      abortTransition = reject
    })

    let changeRoute: () => void
    const ready = new Promise<void>(resolve => (changeRoute = resolve))

    const update = () => {
      changeRoute()
      return promise
    }

    // Use the object form (Level 2) only when types are specified,
    // falling back to the callback form (Level 1) for broader browser support.
    transition = allTypes.length > 0
      ? document.startViewTransition!({ update, types: allTypes })
      : document.startViewTransition!(update)

    transition.finished.then(resetTransitionState)

    await nuxtApp.callHook('page:view-transition:start', transition)

    return ready
  })

  router.onError(() => {
    abortTransition?.()
    resetTransitionState()
  })

  nuxtApp.hook('app:error', () => {
    abortTransition?.()
    resetTransitionState()
  })

  nuxtApp.hook('vue:error', () => {
    abortTransition?.()
    resetTransitionState()
  })

  nuxtApp.hook('page:finish', () => {
    finishTransition?.()
    resetTransitionState()
  })
})
