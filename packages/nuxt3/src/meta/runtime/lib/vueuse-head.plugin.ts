import { createHead, renderHeadToString } from '@vueuse/head'
import { ref } from 'vue'
import type { MetaObject } from '..'
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxt) => {
  const head = createHead()

  nuxt.app.use(head)

  nuxt._useMeta = (meta: MetaObject) => head.addHeadObjs(ref(meta as any))

  if (process.server) {
    nuxt.ssrContext.renderMeta = () => renderHeadToString(head)
  }
})
