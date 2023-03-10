// @ts-expect-error ts failing with type
import { polyfillAsVueUseHead } from '@unhead/vue/polyfill'
import { defineNuxtPlugin } from '#app/nuxt'

export default defineNuxtPlugin((nuxtApp) => {
  // avoid breaking ecosystem dependencies using low-level @vueuse/head APIs
  polyfillAsVueUseHead(nuxtApp.vueApp._context.provides.usehead)
})
