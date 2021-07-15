import { createHead, renderHeadToString } from '@vueuse/head'
import { defineNuxtPlugin } from '@nuxt/app'

export default defineNuxtPlugin((nuxt) => {
  const head = createHead()

  nuxt.app.use(head)

  if (process.server) {
    nuxt.ssrContext.renderMeta = () => renderHeadToString(head)
  }
})
