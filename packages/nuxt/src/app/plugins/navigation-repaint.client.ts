import { defineNuxtPlugin } from '../nuxt'
import { useRouter } from '../composables'

export default defineNuxtPlugin(() => {
  useRouter().beforeResolve(async () => {
    /**
     * This gives an opportunity for the browser to repaint, acknowledging user interaction.
     * It can reduce INP when navigating on prerendered routes.
     *
     * @see https://github.com/nuxt/nuxt/issues/26271#issuecomment-2178582037
     * @see https://vercel.com/blog/demystifying-inp-new-tools-and-actionable-insights
     */
    await new Promise((resolve) => {
      // Ensure we always resolve, even if the animation frame never fires
      setTimeout(resolve, 100)
      requestAnimationFrame(() => { setTimeout(resolve, 0) })
    })
  })
})
