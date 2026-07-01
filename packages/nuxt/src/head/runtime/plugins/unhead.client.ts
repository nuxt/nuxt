import { createHead as createClientHead } from '@unhead/vue/client'
import { installClientHead } from '../install-client-head'
import { defineNuxtPlugin } from '#app/nuxt'
import type { ObjectPlugin, Plugin } from '#app/nuxt'

// @ts-expect-error virtual file
import unheadOptions from '#build/unhead-options.mjs'
// @ts-expect-error virtual file
import { appHead } from '#build/nuxt.config.mjs'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:head',
  enforce: 'pre',
  setup (nuxtApp) {
    const head = createClientHead(unheadOptions)
    // unhead v3's client head no longer inherits the server-only appHead, so re-push `app.head`
    head.push(appHead)
    installClientHead(nuxtApp, head)
  },
})

export default plugin
