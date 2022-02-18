import { createApp } from 'vue'
import { createMetaManager } from 'vue-meta'
import type { MetaObject } from '..'
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  const manager = createMetaManager(process.server)

  nuxtApp.vueApp.use(manager)

  nuxtApp._useMeta = (meta: MetaObject) => manager.addMeta(meta)

  if (process.client) {
    const teleportTarget = document.createElement('div')
    teleportTarget.id = 'head-target'
    document.body.appendChild(teleportTarget)

    createApp({ render: () => manager.render({}) }).mount('#head-target')
  }

  if (process.server) {
    nuxtApp.ssrContext.renderMeta = async () => {
      const { renderMetaToString } = await import('vue-meta/ssr')
      nuxtApp.ssrContext.teleports = nuxtApp.ssrContext.teleports || {}

      await renderMetaToString(nuxtApp.app, nuxtApp.ssrContext)

      return {
        htmlAttrs: nuxtApp.ssrContext.teleports.htmlAttrs || '',
        headAttrs: nuxtApp.ssrContext.teleports.headAttrs || '',
        bodyAttrs: nuxtApp.ssrContext.teleports.bodyAttrs || '',
        headTags: nuxtApp.ssrContext.teleports.head || '',
        bodyScriptsPrepend: nuxtApp.ssrContext.teleports['body-prepend'] || '',
        bodyScripts: nuxtApp.ssrContext.teleports.body || ''
      }
    }
  }
})
