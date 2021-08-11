import { getCurrentInstance } from 'vue'
import * as Components from './components'
import { useMeta } from './composables'
import { defineNuxtPlugin } from '#app'
// @ts-ignore
import metaConfig from '#build/meta.config.mjs'

export default defineNuxtPlugin((nuxt) => {
  useMeta(metaConfig.globalMeta)

  nuxt.app.mixin({
    created () {
      const instance = getCurrentInstance()
      if (!instance?.type || !('head' in instance.type)) { return }

      useMeta((instance.type as any).head)
    }
  })

  for (const name in Components) {
    nuxt.app.component(name, Components[name])
  }
})
