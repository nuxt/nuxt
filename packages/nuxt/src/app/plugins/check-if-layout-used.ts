import { defineNuxtPlugin } from '../nuxt'
import { onNuxtReady } from '../composables/ready'

// @ts-expect-error virtual file
import layouts from '#build/layouts'

export default defineNuxtPlugin({
  name: 'nuxt:checkIfLayoutUsed',
  enforce: 'post',
  setup (nuxtApp) {
    const projectHasLayouts:()=>boolean = () => {
      const numLayouts = Object.keys(layouts).length
      // TODO: Also check layers
      return numLayouts > 0
    }

    onNuxtReady(() => {
      if (!nuxtApp.payload.isNuxtLayoutUsed && projectHasLayouts()) {
        // TODO: Use logger
        console.log('Your project has layouts but the <NuxtLayout /> component has not been used.')
      }
    })
  }
})
