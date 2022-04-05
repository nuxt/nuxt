import { createHead, renderHeadToString } from '@vueuse/head'
import { ref, watchEffect, onBeforeUnmount, getCurrentInstance } from 'vue'
import type { MetaObject } from '..'
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  const head = createHead()

  nuxtApp.vueApp.use(head)

  let headReady = false
  nuxtApp.hooks.hookOnce('app:mounted', () => {
    watchEffect(() => { head.updateDOM() })
    headReady = true
  })

  nuxtApp._useHead = (meta: MetaObject) => {
    const headObj = ref(meta as any)
    head.addHeadObjs(headObj)

    if (process.server) { return }

    if (headReady) {
      watchEffect(() => { head.updateDOM() })
    }

    const vm = getCurrentInstance()
    if (!vm) { return }

    onBeforeUnmount(() => {
      head.removeHeadObjs(headObj)
      head.updateDOM()
    })
  }

  if (process.server) {
    nuxtApp.ssrContext.renderMeta = () => renderHeadToString(head)
  }
})
