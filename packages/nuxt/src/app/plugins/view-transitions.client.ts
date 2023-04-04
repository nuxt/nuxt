import { useRouter } from '#app/composables/router'
import { defineNuxtPlugin } from '#app/nuxt'

export default defineNuxtPlugin((nuxtApp) => {
  let finishTransition: undefined | (() => void)

  useRouter().beforeResolve(async (to) => {
    if (!document.startViewTransition || to.meta.pageTransition === false) { return }

    await nuxtApp.callHook('page:transition:start')

    const promise = new Promise<void>((resolve) => {
      finishTransition = resolve
    })

    let changeRoute: () => void
    const ready = new Promise<void>(resolve => (changeRoute = resolve))

    const transition = document.startViewTransition(() => {
      changeRoute()
      return promise
    })
    transition.finished.then(() => nuxtApp.callHook('page:transition:finish'))

    await ready
  })

  nuxtApp.hook('page:finish', () => {
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
