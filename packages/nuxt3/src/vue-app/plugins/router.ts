import { ref } from 'vue'
import { createRouter, createWebHistory, createMemoryHistory } from 'vue-router'

import type { Plugin } from 'nuxt/vue-app/types'

import routes from 'nuxt-build/routes'

const router: Plugin = function ({ app }) {
  const routerHistory = process.client
    ? createWebHistory()
    : createMemoryHistory()

  const router = createRouter({
    history: routerHistory,
    routes
  })
  app.use(router)

  const previousRoute = ref()
  router.afterEach((to, from) => {
    previousRoute.value = from
  })

  Object.defineProperty(app.config.globalProperties, 'previousRoute', {
    get: () => previousRoute.value
  })

  if (process.server) {
    app.$nuxt.hook('server:create', async () => {
      router.push(app.$nuxt.ssrContext.url)
      await router.isReady()
    })
  } else {
    app.$nuxt.hook('client:create', async () => {
      router.push(router.history.location.fullPath)
      await router.isReady()
    })
  }
}

export default router