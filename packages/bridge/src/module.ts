import { defineNuxtModule, installModule } from '@nuxt/kit'
import { setupNitroBridge } from './nitro'
import { setupAppBridge } from './app'
import { setupCAPIBridge } from './capi'

export default defineNuxtModule({
  name: 'nuxt-bridge',
  configKey: 'bridge',
  defaults: {
    nitro: true,
    vite: false,
    app: {},
    capi: {},
    // TODO: Remove from 2.16
    postcss8: true,
    swc: true
  },
  async setup (opts, nuxt) {
    if (opts.nitro) {
      await setupNitroBridge()
    }
    if (opts.app) {
      await setupAppBridge(opts.app)
    }
    if (opts.capi) {
      if (!opts.app) {
        throw new Error('[bridge] Cannot enable composition-api with app disabled!')
      }
      await setupCAPIBridge(opts.capi)
    }
    if (opts.vite) {
      await installModule(nuxt, require.resolve('nuxt-vite'))
    }
    if (opts.postcss8) {
      await installModule(nuxt, require.resolve('@nuxt/postcss8'))
    }
    if (opts.swc) {
      await installModule(nuxt, require.resolve('nuxt-swc'))
    }
  }
})
