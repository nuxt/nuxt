import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'
import { onNuxtReady } from '../composables/ready'
import { useRouter } from '../composables/router'
import { nextFrame } from '../internal/yield'
import { viewTransition } from '#build/nuxt.config.mjs'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  let transition: ViewTransition | undefined
  if (viewTransition) {
    nuxtApp.hook('page:view-transition:start', (currentTransition) => {
      transition = currentTransition
      const resetTransition = () => {
        if (transition === currentTransition) {
          transition = undefined
        }
      }
      currentTransition.updateCallbackDone.then(resetTransition, resetTransition)
    })
  }

  onNuxtReady(() => {
    router.beforeResolve(() => {
      // Rendering is paused until the view transition's update callback completes.
      if (viewTransition && transition) { return }

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
