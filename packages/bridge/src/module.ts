import { createRequire } from 'module'
import { defineNuxtModule, installModule } from '@nuxt/kit'
import { setupNitroBridge } from './nitro'
import { setupAppBridge } from './app'
import { setupCAPIBridge } from './capi'
import { setupBetterResolve } from './resolve'
import { setupGlobalImports } from './global-imports'

export default defineNuxtModule({
  name: 'nuxt-bridge',
  configKey: 'bridge',
  defaults: {
    nitro: true,
    vite: false,
    app: {},
    capi: {},
    globalImports: true,
    // TODO: Remove from 2.16
    postcss8: true,
    swc: true,
    resolve: true
  },
  async setup (opts, nuxt) {
    const _require = createRequire(import.meta.url)

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
    if (opts.globalImports) {
      await setupGlobalImports()
    }
    if (opts.vite) {
      await installModule(nuxt, _require.resolve('nuxt-vite'))
    }
    if (opts.postcss8) {
      await installModule(nuxt, _require.resolve('@nuxt/postcss8'))
    }
    if (opts.swc) {
      await installModule(nuxt, _require.resolve('nuxt-swc'))
    }
    if (opts.resolve) {
      setupBetterResolve()
    }
  }
})
