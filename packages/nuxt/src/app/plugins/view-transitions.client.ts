import { isChangingPage } from '../components/utils'
import { useRouter } from '../composables/router'
import { defineNuxtPlugin } from '../nuxt'
// @ts-expect-error virtual file
import { appViewTransition as defaultViewTransition } from '#build/nuxt.config.mjs'

export default defineNuxtPlugin((nuxtApp) => {
  if (!document.startViewTransition) {
    return
  }

  let finishTransition: undefined | (() => void)
  let abortTransition: undefined | (() => void)

  const router = useRouter()

  router.beforeResolve(async (to, from) => {
    const viewTransitionMode = to.meta.viewTransition ?? defaultViewTransition
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const prefersNoTransition = prefersReducedMotion && viewTransitionMode !== 'always'

    if (viewTransitionMode === false || prefersNoTransition || !isChangingPage(to, from)) {
      return
    }

    const promise = new Promise<void>((resolve, reject) => {
      finishTransition = resolve
      abortTransition = reject
    })

    let changeRoute: () => void
    const ready = new Promise<void>(resolve => (changeRoute = resolve))

    const transition = document.startViewTransition!(() => {
      changeRoute()
      return promise
    })

    transition.finished.then(() => {
      abortTransition = undefined
      finishTransition = undefined
    })

    await nuxtApp.callHook('page:view-transition:start', transition)

    return ready
  })

  nuxtApp.hook('vue:error', () => {
    abortTransition?.()
    abortTransition = undefined
  })

  nuxtApp.hook('page:finish', () => {
    finishTransition?.()
    finishTransition = undefined
  })
})

export interface ViewTransition {
  ready: Promise<void>
  finished: Promise<void>
  updateCallbackDone: Promise<void>
}

declare global {
  interface Document {
    startViewTransition?: (callback: () => Promise<void> | void) => ViewTransition
  }
}
