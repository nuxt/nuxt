import { useRouter } from '#app/composables/router'
import { defineNuxtPlugin } from '#app/nuxt'

export default defineNuxtPlugin((nuxtApp) => {
  let finishTransition: undefined | (() => void)
  let abortTransition: undefined | (() => void)

  const router = useRouter()

  router.beforeResolve(async (to) => {
    if (!document.startViewTransition || to.meta.pageTransition === false) { return }

    await nuxtApp.callHook('page:transition:start')

    const promise = new Promise<void>((resolve, reject) => {
      finishTransition = resolve
      abortTransition = reject
    })

    let changeRoute: () => void
    const ready = new Promise<void>(resolve => (changeRoute = resolve))

    const transition = document.startViewTransition(() => {
      changeRoute()
      return promise
    })

    transition.finished.then(() => {
      abortTransition = undefined
      finishTransition = undefined
      return nuxtApp.callHook('page:transition:finish')
    })

    await ready
  })

  nuxtApp.hook('vue:error', () => {
    if (!document.startViewTransition) { return }
    abortTransition?.()
    abortTransition = undefined
  })

  nuxtApp.hook('page:finish', () => {
    if (!document.startViewTransition) { return }
    finishTransition?.()
    finishTransition = undefined
  })
})

declare global {
  interface Document {
    startViewTransition?: (callback: () => Promise<void> | void) => {
      finished: Promise<void>
      updateCallbackDone: Promise<void>
      ready: Promise<void>
    }
  }
}
