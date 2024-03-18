import { defineNuxtPlugin } from '../nuxt'
// @ts-expect-error virtual file
import { hasPages, isNuxtLayoutUsed, isNuxtPageUsed } from '#build/detected-component-usage.mjs'
// @ts-expect-error virtual file
import layouts from '#build/layouts'

export default defineNuxtPlugin({
  name: 'nuxt:check-component-usage',
  setup (nuxtApp) {
    const cache = new Set<string>()

    nuxtApp.hook('app:mounted', () => {
      if (Object.keys(layouts).length > 0 && !isNuxtLayoutUsed && !cache.has('NuxtLayout')) {
        console.warn('[nuxt] Your project has layouts but the `<NuxtLayout />` component has not been used')
        cache.add('NuxtLayout')
      }

      if (hasPages && !isNuxtPageUsed && !cache.has('NuxtPage')) {
        console.warn('[nuxt] Your project has pages but the `<NuxtPage />` component has not been used.' +
          ' You might be using the `<RouterView />` component instead, which will not work correctly in Nuxt.' +
          ' You can set `pages: false` in `nuxt.config` if you do not wish to use the Nuxt `vue-router` integration.')
        cache.add('NuxtPage')
      }
    })
  }
})
