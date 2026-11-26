import { defineNuxtPlugin } from '#app/nuxt'
import type { ObjectPlugin, Plugin } from '#app/nuxt'
import { prerenderRoutes } from '#app/composables/ssr'
import { getRouteRules } from '#app/composables/manifest'
import { prerenderPaths } from '#build/routes'
import { hashMode } from '#build/router.options.mjs'
import { crawlLinks } from '#build/nuxt.config.mjs'

let routes: string[]

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin(() => {
  if (!import.meta.server || !import.meta.prerender || hashMode) {
    return
  }
  if (routes && !routes.length) { return }

  routes ||= prerenderPaths.filter(path => crawlLinks || !!getRouteRules({ path }).prerender)
  prerenderRoutes(routes.splice(0, 10))
})

export default plugin
