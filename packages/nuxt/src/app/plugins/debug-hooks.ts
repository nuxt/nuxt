import { createDebugger } from 'hookable'
import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:debug:hooks',
  enforce: 'pre',
  setup (nuxtApp) {
    createDebugger(nuxtApp.hooks, { tag: 'nuxt-app' })
  },
})

export default plugin
