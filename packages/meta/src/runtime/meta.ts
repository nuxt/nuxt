import { getCurrentInstance } from 'vue'
import { defineNuxtPlugin } from '@nuxt/app'
import * as Components from './components'
import { useMeta } from './index'

export default defineNuxtPlugin((nuxt) => {
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
