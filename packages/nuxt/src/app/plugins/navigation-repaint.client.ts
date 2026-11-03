import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'
import { onNuxtReady } from '../composables/ready'
import { useRouter } from '../composables/router'
import { nextFrame } from '../internal/yield'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin(() => {
  const router = useRouter()
  onNuxtReady(() => {
    router.beforeResolve(() => {
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
