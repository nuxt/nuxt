import { createApp } from 'vue'
import { createMetaManager } from 'vue-meta'
import type { MetaObject } from '..'
import { defineNuxtPlugin } from '#app'
// @ts-expect-error untyped
import { appHead } from '#build/nuxt.config.mjs'

export default defineNuxtPlugin((nuxtApp) => {
  // @ts-expect-error missing resolver
  const manager = createMetaManager(process.server)
  manager.addMeta(appHead)

  nuxtApp.vueApp.use(manager)

  nuxtApp._useHead = (meta: MetaObject) => manager.addMeta(meta)

  if (process.client) {
    const teleportTarget = document.createElement('div')
    teleportTarget.id = 'head-target'
    document.body.appendChild(teleportTarget)

    createApp({ render: () => manager.render({}) }).mount('#head-target')
  }

  if (process.server) {
    nuxtApp.ssrContext!.renderMeta = async () => {
      // @ts-ignore
      const { renderMetaToString } = await import('vue-meta/ssr')
      nuxtApp.ssrContext!.teleports = nuxtApp.ssrContext!.teleports || {}

      await renderMetaToString(nuxtApp.app, nuxtApp.ssrContext)

      return {
        htmlAttrs: nuxtApp.ssrContext!.teleports.htmlAttrs || '',
        headAttrs: nuxtApp.ssrContext!.teleports.headAttrs || '',
        bodyAttrs: nuxtApp.ssrContext!.teleports.bodyAttrs || '',
        headTags: nuxtApp.ssrContext!.teleports.head || '',
        bodyScriptsPrepend: nuxtApp.ssrContext!.teleports['body-prepend'] || '',
        bodyScripts: nuxtApp.ssrContext!.teleports.body || ''
      }
    }
  }
})
