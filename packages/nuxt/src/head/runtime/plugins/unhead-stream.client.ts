import { createHead as createClientHead } from '@unhead/vue/client'
import { createStreamableHead as createStreamableClientHead } from '@unhead/vue/stream/client'
import { installClientHead } from '../install-client-head'
import { defineNuxtPlugin } from '#app/nuxt'
import type { ObjectPlugin, Plugin } from '#app/nuxt'

import unheadOptions from '#build/unhead-options.mjs'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:head',
  enforce: 'pre',
  setup (nuxtApp) {
    // `createStreamableHead` consumes the `window.__unhead__` queue
    // populated during SSR streaming, falling back to `createClientHead`
    // when no queue is found (e.g. bot requests served buffered).
    const head = createStreamableClientHead(unheadOptions) || createClientHead(unheadOptions)
    installClientHead(nuxtApp, head)
  },
})

export default plugin
