import { defineNuxtPlugin } from '../nuxt'
import { onNuxtReady } from '../composables/ready'

export default defineNuxtPlugin({
  name: 'nuxt:checkIfLayoutUsed',
  enforce: 'post',
  setup (nuxtApp) {
    onNuxtReady(() => {
      const hasLayouts = false // TODO:
      if (!nuxtApp.payload.isNuxtLayoutUsed && hasLayouts) {
        console.log('Your project has layouts but the <NuxtLayout /> component has not been used.')
      }
    })
  }
})
