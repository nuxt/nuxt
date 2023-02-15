import { defineNuxtPlugin } from '#app/nuxt'
import { useRouter } from '#app/composables/router'

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()

  let chunkError: TypeError | null = null
  nuxtApp.hook('app:chunkError', ({ error }) => { chunkError = error })

  router.onError((error, to) => {
    if (chunkError !== error) { return }

    let handledPath: Record<string, any> = {}
    try {
      handledPath = JSON.parse(localStorage.getItem('nuxt:reload') || '{}')
    } catch {}

    if (handledPath?.path !== to.fullPath || handledPath?.expires < Date.now()) {
      localStorage.setItem('nuxt:reload', JSON.stringify({ path: to.fullPath, expires: Date.now() + 10000 }))
      window.location.href = to.fullPath
    }
  })
})
