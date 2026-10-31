import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'
import { onNuxtReady } from '../composables/ready'
import { useRouter } from '../composables/router'
import { nextFrame } from '../internal/yield'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()

  // the browser does not render while a view transition's update callback is pending
  let pendingTransition: ViewTransition | undefined
  nuxtApp.hook('page:view-transition:start', (transition) => {
    pendingTransition = transition
    const clear = () => {
      if (pendingTransition === transition) {
        pendingTransition = undefined
      }
    }
    transition.updateCallbackDone.then(clear, clear)
  })

  onNuxtReady(() => {
    router.beforeResolve(() => {
      if (pendingTransition) {
        return
      }
      /**
       * This gives an opportunity for the browser to repaint, acknowledging user interaction.
       * It can reduce INP when navigating on prerendered routes.
       *
       * @see https://github.com/nuxt/nuxt/issues/26271#issuecomment-2178582037
       * @see https://vercel.com/blog/demystifying-inp-new-tools-and-actionable-insights
       */
      return nextFrame()
    })
  })
})

export default plugin
