import { isChangingPage } from '../components/utils'
import { useRouter } from '../composables/router'
import { defineNuxtPlugin } from '../nuxt'
import type { ViewTransitionOptions, ViewTransitionPageOptions } from '../../../../schema/src/types/config'
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

  router.beforeResolve(async (to, from) => {
    const toViewTransitionOptions = to.meta.viewTransition as ViewTransitionPageOptions
    const fromViewTransitionOptions = from.meta.viewTransition as ViewTransitionPageOptions
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

    const resolveViewTransitionTypes = (types: ViewTransitionOptions['types']) => {
      return types ? typeof types === 'function' ? types(to, from) : types : undefined
    }

    const viewTransitionBaseTypes =
      resolveViewTransitionTypes(toViewTransitionOptions.types) ??
      resolveViewTransitionTypes(defaultViewTransition.types) ??
      []
    const viewTransitionFromTypes = resolveViewTransitionTypes(fromViewTransitionOptions.fromTypes) ?? []
    const viewTransitionToTypes = resolveViewTransitionTypes(fromViewTransitionOptions.toTypes) ?? []

    const promise = new Promise<void>((resolve, reject) => {
      finishTransition = resolve
      abortTransition = reject
    })

    let changeRoute: () => void
    const ready = new Promise<void>(resolve => (changeRoute = resolve))

    transition = document.startViewTransition!({
      // @ts-expect-error update is not in the type
      update: () => {
        changeRoute()
        return promise
      },
      types: [
        ...viewTransitionBaseTypes,
        ...viewTransitionFromTypes,
        ...viewTransitionToTypes,
      ],
    })

    transition.finished.then(resetTransitionState)

    await nuxtApp.callHook('page:view-transition:start', transition)

    return ready
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
