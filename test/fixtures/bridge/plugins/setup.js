import { onGlobalSetup, ref } from '@nuxtjs/composition-api'

import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxt) => {
  const globalsetup = ref('🚧')
  onGlobalSetup(() => {
    globalsetup.value = '✅'
  })
  nuxt.provide('globalsetup', globalsetup)
})
