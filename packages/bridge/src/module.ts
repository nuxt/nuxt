import { createRequire } from 'module'
import { defineNuxtModule, installModule, checkNuxtCompatibility, nuxtCtx } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'
import { NuxtCompatibility } from '@nuxt/schema/src/types/compatibility'
import type { BridgeConfig, ScriptSetupOptions } from '../types'
import { setupNitroBridge } from './nitro'
import { setupAppBridge } from './app'
import { setupCAPIBridge } from './capi'
import { setupBetterResolve } from './resolve'
import { setupAutoImports } from './auto-imports'
import { setupTypescript } from './typescript'
import { setupMeta } from './meta'
import { setupTranspile } from './transpile'
import { setupScriptSetup } from './setup'

export default defineNuxtModule({
  meta: {
    name: 'nuxt-bridge',
    configKey: 'bridge'
  },
  defaults: {
    nitro: true,
    vite: false,
    app: {},
    capi: {},
    transpile: true,
    scriptSetup: true,
    autoImports: true,
    compatibility: true,
    meta: null,
    // TODO: Remove from 2.16
    postcss8: true,
    typescript: true,
    resolve: true
  } as BridgeConfig,
  async setup (opts, nuxt) {
    const _require = createRequire(import.meta.url)

    // Allow using kit compasables in all modules
    if (!nuxtCtx.use()) {
      nuxtCtx.set(nuxt)
    }

    // Mock _layers
    nuxt.options._layers = nuxt.options._layers || [{
      config: nuxt.options,
      cwd: nuxt.options.rootDir,
      configFile: nuxt.options._nuxtConfigFile
    }]

    if (opts.nitro) {
      nuxt.hook('modules:done', async () => {
        await setupNitroBridge()
      })
    }
    if (opts.app) {
      await setupAppBridge(opts.app)
    }
    if (opts.capi) {
      if (!opts.app) {
        throw new Error('[bridge] Cannot enable composition-api with app disabled!')
      }
      await setupCAPIBridge(opts.capi === true ? {} : opts.capi)
    }
    if (opts.scriptSetup) {
      await setupScriptSetup(opts.scriptSetup as ScriptSetupOptions)
    }
    if (opts.autoImports) {
      await setupAutoImports()
    }
    if (opts.vite) {
      const viteModule = await import('./vite/module').then(r => r.default || r) as NuxtModule
      nuxt.hook('modules:done', () => installModule(viteModule))
    }
    if (opts.postcss8) {
      await installModule(_require.resolve('@nuxt/postcss8'))
    }
    if (opts.typescript) {
      await setupTypescript()
    }
    if (opts.resolve) {
      setupBetterResolve()
    }
    if (opts.transpile) {
      setupTranspile()
    }
    if (opts.compatibility) {
      nuxt.hook('modules:done', async (moduleContainer: any) => {
        for (const [name, m] of Object.entries(moduleContainer.requiredModules || {})) {
          const compat = ((m as any)?.handler?.meta?.compatibility || {}) as NuxtCompatibility
          if (compat) {
            const issues = await checkNuxtCompatibility(compat, nuxt)
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
