import { defineNuxtPlugin } from '#app/nuxt'
import { useRouter } from '#app/composables/router'
import { reloadNuxtApp } from '#app/composables/chunk'

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()

  const chunkErrors = new Set()

  router.beforeEach(() => { chunkErrors.clear() })
  nuxtApp.hook('app:chunkError', ({ error }) => { chunkErrors.add(error) })

  router.onError((error, to) => {
    if (chunkErrors.has(error)) {
      reloadNuxtApp({ path: to.fullPath })
    }
  })
})
