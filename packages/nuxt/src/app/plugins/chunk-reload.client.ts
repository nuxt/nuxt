import { joinURL } from 'ufo'
import type { RouteLocationNormalized } from 'vue-router'
import { defineNuxtPlugin, useRuntimeConfig } from '../nuxt'
import { useRouter } from '../composables/router'
import { reloadNuxtApp } from '../composables/chunk'

export default defineNuxtPlugin({
  name: 'nuxt:chunk-reload',
  setup (nuxtApp) {
    const router = useRouter()
    const config = useRuntimeConfig()

    const chunkErrors = new Set()

    router.beforeEach(() => { chunkErrors.clear() })
    nuxtApp.hook('app:chunkError', ({ error }) => { chunkErrors.add(error) })

    function reloadAppAtPath (to: RouteLocationNormalized) {
      const isHash = 'href' in to && (to.href as string).startsWith('#')
      const path = isHash ? config.app.baseURL + (to as any).href : joinURL(config.app.baseURL, to.fullPath)
      reloadNuxtApp({ path, persistState: true })
    }

    nuxtApp.hook('app:manifest:update', () => {
      router.beforeResolve(reloadAppAtPath)
    })

    router.onError((error, to) => {
      if (chunkErrors.has(error)) {
        reloadAppAtPath(to)
      }
    })
  }
})
