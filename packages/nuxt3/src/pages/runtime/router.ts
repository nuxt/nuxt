import { shallowRef } from 'vue'
import {
  createRouter,
  createWebHistory,
  createMemoryHistory,
  RouterLink
} from 'vue-router'
// @ts-ignore
import NuxtPage from './page.vue'
import NuxtLayout from './layout'
import { defineNuxtPlugin } from '#app'
// @ts-ignore
import routes from '#build/routes'

export default defineNuxtPlugin((nuxt) => {
  const { app } = nuxt

  app.component('NuxtPage', NuxtPage)
  app.component('NuxtLayout', NuxtLayout)
  app.component('NuxtLink', RouterLink)

  const routerHistory = process.client
    ? createWebHistory()
    : createMemoryHistory()

  const router = createRouter({
    history: routerHistory,
    routes
  })
  app.use(router)
  nuxt.provide('router', router)

  const previousRoute = shallowRef(router.currentRoute.value)
  router.afterEach((_to, from) => {
    previousRoute.value = from
  })

  Object.defineProperty(app.config.globalProperties, 'previousRoute', {
    get: () => previousRoute.value
  })

  nuxt.hook('app:created', async () => {
    if (process.server) {
      router.push(nuxt.ssrContext.url)
    }

    await router.isReady()

    const is404 = router.currentRoute.value.matched.length === 0
    if (process.server && is404) {
      const error = new Error(`Page not found: ${nuxt.ssrContext.url}`)
      // @ts-ignore
      error.statusCode = 404
      nuxt.ssrContext.error = error
    }
  })
})
