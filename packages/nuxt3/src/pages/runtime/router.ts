import { computed, reactive, shallowRef } from 'vue'
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

declare module 'vue' {
  export interface GlobalComponents {
    NuxtChild: typeof NuxtChild
    NuxtPage: typeof NuxtPage
    NuxtLayout: typeof NuxtLayout
    NuxtLink: typeof RouterLink
  }
}

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

  const previousRoute = shallowRef(router.currentRoute.value)
  router.afterEach((_to, from) => {
    previousRoute.value = from
  })

  Object.defineProperty(nuxtApp.vueApp.config.globalProperties, 'previousRoute', {
    get: () => previousRoute.value
  })

  // https://github.com/vuejs/vue-router-next/blob/master/src/router.ts#L1192-L1200
  const route = {}
  for (const key in router.currentRoute.value) {
    route[key] = computed(() => router.currentRoute.value[key])
  }

  nuxtApp._route = reactive(route)

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

  return { provide: { router } }
})
