import { createRequire } from 'module'
import { defineNuxtModule, installModule, checkNuxtCompatibilityIssues } from '@nuxt/kit'
import type { BridgeConfig } from '../types'
import { setupNitroBridge } from './nitro'
import { setupAppBridge } from './app'
import { setupCAPIBridge } from './capi'
import { setupBetterResolve } from './resolve'
import { setupGlobalImports } from './global-imports'
import { setupTypescript } from './typescript'
import { setupMeta } from './meta'

export default defineNuxtModule({
  name: 'nuxt-bridge',
  configKey: 'bridge',
  defaults: {
    nitro: true,
    vite: false,
    app: {},
    capi: {},
    globalImports: true,
    constraints: true,
    meta: null,
    // TODO: Remove from 2.16
    postcss8: true,
    typescript: true,
    resolve: true
  } as BridgeConfig,
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
    if (opts.typescript) {
      await setupTypescript()
    }
    if (opts.resolve) {
      setupBetterResolve()
    }
    if (opts.constraints) {
      nuxt.hook('modules:done', (moduleContainer: any) => {
        for (const [name, m] of Object.entries(moduleContainer.requiredModules || {})) {
          const requires = (m as any)?.handler?.meta?.requires
          if (requires) {
            const issues = checkNuxtCompatibilityIssues(requires, nuxt)
            if (issues.length) {
              console.warn(`[bridge] Detected module incompatibility issues for \`${name}\`:\n` + issues.toString())
            }
          }
        }
      })
    }
    if (opts.meta !== false && opts.capi) {
      await setupMeta({ needsExplicitEnable: opts.meta === null })
    }
  }
})
