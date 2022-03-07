import { onGlobalSetup, ref } from '@nuxtjs/composition-api'

import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(() => {
  const globalsetup = ref('🚧')
  onGlobalSetup(() => {
    globalsetup.value = '✅'
  })
  return {
    provide: {
      globalsetup
    }
  }
})
