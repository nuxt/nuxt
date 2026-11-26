import type { Router } from 'vue-router'
import { RouterView } from 'vue-router'
import { RouterLink, experimental_createRouter } from 'vue-router/experimental'

import { defineNuxtPlugin } from '#app/nuxt'
import { setupNuxtRouter } from '../../router-plugin'

import { handleHotUpdate, resolver } from '#build/routes'
import routerOptions from '#build/router.options.mjs'

// `parseQuery` is ignored by the experimental router, which parses every query value into an array
const { parseQuery, ...options } = routerOptions

export default defineNuxtPlugin({
  name: 'nuxt:router',
  enforce: 'pre',
  setup: setupNuxtRouter(({ history, scrollBehavior, nuxtApp }) => {
    // the route table is compiled at build time, so the resolver is shared between requests and apps
    const router = experimental_createRouter({
      ...options,
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      scrollBehavior,
      history,
      resolver,
    }) as unknown as Router

    // the experimental router leaves the registration of its components to the app. `<NuxtLink>` renders `RouterLink`.
    nuxtApp.vueApp.component('RouterLink', RouterLink)
    nuxtApp.vueApp.component('RouterView', RouterView)

    if (import.meta.hot) {
      handleHotUpdate(router)
    }

    return router
  }),
})
