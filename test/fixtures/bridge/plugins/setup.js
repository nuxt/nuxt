import { onGlobalSetup, ref } from '@nuxtjs/composition-api'

import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  const globalsetup = ref('🚧')
  onGlobalSetup(() => {
    globalsetup.value = '✅'
  })
  nuxtApp.provide('globalsetup', globalsetup)
})
