import { joinURL } from 'ufo'
import type { RouteLocationNormalized, Router } from 'vue-router'
import type { RuntimeConfig } from 'nuxt/schema'
import { defineNuxtPlugin, useRuntimeConfig } from '../nuxt'
import { useRouter } from '../composables/router'
import { reloadNuxtApp } from '../composables/chunk'

function createReloadAppAtPath (config: RuntimeConfig) {
  return (to: RouteLocationNormalized) => {
    const path = joinURL(config.app.baseURL, to.fullPath)
    reloadNuxtApp({ path, persistState: true })
  }
}

function createClearChunkErrors (chunkErrors: Set<Error>) {
  return () => { chunkErrors.clear() }
}

function createChunkErrorHandler (chunkErrors: Set<Error>) {
  return ({ error }: { error: Error }) => { chunkErrors.add(error) }
}

function createManifestUpdateHandler (router: Router, reloadAppAtPath: (to: RouteLocationNormalized) => void) {
  return () => { router.beforeResolve(reloadAppAtPath) }
}

function createRouterErrorHandler (chunkErrors: Set<Error>, reloadAppAtPath: (to: RouteLocationNormalized) => void) {
  return (error: Error, to: RouteLocationNormalized) => {
    if (chunkErrors.has(error)) {
      reloadAppAtPath(to)
    }
  }
}

export default defineNuxtPlugin({
  name: 'nuxt:chunk-reload',
  setup (nuxtApp) {
    const router = useRouter()
    const config = useRuntimeConfig()

    const chunkErrors = new Set<Error>()
    const reloadAppAtPath = createReloadAppAtPath(config)

    router.beforeEach(createClearChunkErrors(chunkErrors))
    nuxtApp.hook('app:chunkError', createChunkErrorHandler(chunkErrors))
    nuxtApp.hook('app:manifest:update', createManifestUpdateHandler(router, reloadAppAtPath))
    router.onError(createRouterErrorHandler(chunkErrors, reloadAppAtPath))
  },
})
