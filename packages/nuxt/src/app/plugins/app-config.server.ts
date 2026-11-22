import { defineNuxtPlugin } from '../nuxt'
import { _getAppConfigDiff, useAppConfig } from '../config'

/**
 * Carries changes made to the app config during server rendering to the client,
 * which applies them on hydration. (#21630)
 */
const plugin = defineNuxtPlugin({
  name: 'nuxt:app-config',
  setup (nuxtApp) {
    nuxtApp.hooks.hookOnce('app:rendered', () => {
      const appConfigDiff = _getAppConfigDiff(useAppConfig())
      if (appConfigDiff) {
        nuxtApp.payload.appConfig = appConfigDiff
      }
    })
  },
})

export default plugin
