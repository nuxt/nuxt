import { createHead, renderHeadToString } from '@vueuse/head'
import { ref, watchEffect, onBeforeUnmount } from 'vue'
import type { MetaObject } from '..'
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxt) => {
  const head = createHead()

  nuxt.app.use(head)

  nuxt._useMeta = (meta: MetaObject) => {
    const headObj = ref(meta as any)
    head.addHeadObjs(headObj)

    if (process.server) { return }

    watchEffect(() => {
      head.updateDOM()
    })

    onBeforeUnmount(() => {
      head.removeHeadObjs(headObj)
      head.updateDOM()
    })
  }

  if (process.server) {
    nuxt.ssrContext.renderMeta = () => renderHeadToString(head)
  }
})
