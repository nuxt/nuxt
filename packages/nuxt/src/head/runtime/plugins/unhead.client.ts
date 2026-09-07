import { createHead as createClientHead } from '@unhead/vue/client'
import { installClientHead } from '../install-client-head'
import { defineNuxtPlugin } from '#app/nuxt'
import type { ObjectPlugin, Plugin } from '#app/nuxt'

import unheadOptions from '#build/unhead-options.mjs'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:head',
  enforce: 'pre',
  setup (nuxtApp) {
    const head = createClientHead(unheadOptions)
    installClientHead(nuxtApp, head)
  },
})

export default plugin
