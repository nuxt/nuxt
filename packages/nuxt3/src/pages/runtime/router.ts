import { shallowRef } from 'vue'
import {
  createRouter,
  createWebHistory,
  createMemoryHistory,
  RouterLink
} from 'vue-router'
import NuxtChild from './child.vue'
import NuxtPage from './page.vue'
import NuxtLayout from './layout'
import { defineNuxtPlugin } from '#app'
// @ts-ignore
import routes from '#build/routes'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('NuxtChild', NuxtChild)
  nuxtApp.vueApp.component('NuxtPage', NuxtPage)
  nuxtApp.vueApp.component('NuxtLayout', NuxtLayout)
  nuxtApp.vueApp.component('NuxtLink', RouterLink)

  const routerHistory = process.client
    ? createWebHistory()
    : createMemoryHistory()

  const router = createRouter({
    history: routerHistory,
    routes
  })
  nuxtApp.vueApp.use(router)
  nuxtApp.provide('router', router)

  const previousRoute = shallowRef(router.currentRoute.value)
  router.afterEach((_to, from) => {
    previousRoute.value = from
  })

  Object.defineProperty(nuxtApp.vueApp.config.globalProperties, 'previousRoute', {
    get: () => previousRoute.value
  })

  nuxtApp.hook('app:created', async () => {
    if (process.server) {
      router.push(nuxtApp.ssrContext.url)
    }

    await router.isReady()

    const is404 = router.currentRoute.value.matched.length === 0
    if (process.server && is404) {
      const error = new Error(`Page not found: ${nuxtApp.ssrContext.url}`)
      // @ts-ignore
      error.statusCode = 404
      nuxtApp.ssrContext.error = error
    }
  })
})
