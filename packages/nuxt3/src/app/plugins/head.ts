import type { Plugin } from 'nuxt/app'
import { createHead, renderHeadToString } from '@vueuse/head'

export default <Plugin> function head (nuxt) {
  const { app, ssrContext } = nuxt
  const head = createHead()

  app.use(head)

  if (process.server) {
    ssrContext.head = () => renderHeadToString(head)
  }
}
