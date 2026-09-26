import { createDebugger } from 'hookable'
import type { Hookable } from 'hookable'
import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:debug:hooks',
  enforce: 'pre',
  setup (nuxtApp) {
    // `createDebugger` is typed against hookable's class, not its public surface
    createDebugger(nuxtApp.hooks as unknown as Hookable<any>, { tag: 'nuxt-app' })
  },
})

export default plugin
