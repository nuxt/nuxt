import { createHead, renderHeadToString } from '@vueuse/head'
import { computed, ref, unref, watchEffect, onBeforeUnmount, getCurrentInstance, ComputedGetter } from 'vue'
import defu from 'defu'
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

  const titleTemplate = ref<MetaObject['titleTemplate']>()

  nuxtApp._useHead = (meta: MetaObject | ComputedGetter<MetaObject>) => {
    titleTemplate.value = (unref(meta) as MetaObject).titleTemplate || titleTemplate.value

    const headObj = computed(() => {
      const overrides: MetaObject = { meta: [] }
      const val = unref(meta) as MetaObject
      if (titleTemplate.value && 'title' in val) {
        overrides.title = typeof titleTemplate.value === 'function' ? titleTemplate.value(val.title) : titleTemplate.value.replace(/%s/g, val.title)
      }
      if (val.charset) {
        overrides.meta!.push({ key: 'charset', charset: val.charset })
      }
      if (val.viewport) {
        overrides.meta!.push({ name: 'viewport', content: val.viewport })
      }
      return defu(overrides, val)
    })
    head.addHeadObjs(headObj as any)

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
