import { shallowRef } from 'vue'
import {
  createRouter,
  createWebHistory,
  createMemoryHistory,
  RouterLink
} from 'vue-router'
// @ts-ignore
import { defineNuxtPlugin } from '@nuxt/app'
import NuxtPage from './page.vue'
import NuxtLayout from './layout'
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
    try {
      await router.isReady()
      if (!router.currentRoute.value.matched.length) {
        // TODO
      }
    } catch (err) {
      // TODO
    }
  })
})
