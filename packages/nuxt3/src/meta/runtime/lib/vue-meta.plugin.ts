import { createApp } from 'vue'
import { createMetaManager } from 'vue-meta'
import type { MetaObject } from '../types'
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxt) => {
  const manager = createMetaManager(process.server)

  nuxt.vueApp.use(manager)

  nuxt._useMeta = (meta: MetaObject) => manager.addMeta(meta)

  if (process.client) {
    const teleportTarget = document.createElement('div')
    teleportTarget.id = 'head-target'
    document.body.appendChild(teleportTarget)

    createApp({ render: () => manager.render({}) }).mount('#head-target')
  }

  if (process.server) {
    nuxt.ssrContext.renderMeta = async () => {
      const { renderMetaToString } = await import('vue-meta/ssr')
      nuxt.ssrContext.teleports = nuxt.ssrContext.teleports || {}

      await renderMetaToString(nuxt.app, nuxt.ssrContext)

      return {
        htmlAttrs: nuxt.ssrContext.teleports.htmlAttrs || '',
        headAttrs: nuxt.ssrContext.teleports.headAttrs || '',
        bodyAttrs: nuxt.ssrContext.teleports.bodyAttrs || '',
        headTags: nuxt.ssrContext.teleports.head || '',
        bodyPrepend: nuxt.ssrContext.teleports['body-prepend'] || '',
        bodyScripts: nuxt.ssrContext.teleports.body || ''
      }
    }
  }
})
