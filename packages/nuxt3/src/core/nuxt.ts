import { resolve } from 'pathe'
import { createHooks } from 'hookable'
import type { Nuxt, NuxtOptions, NuxtConfig, ModuleContainer, NuxtHooks } from '@nuxt/schema'
import { loadNuxtConfig, LoadNuxtOptions, nuxtCtx, installModule, addComponent } from '@nuxt/kit'
import pagesModule from '../pages/module'
import metaModule from '../meta/module'
import componentsModule from '../components/module'
import autoImportsModule from '../auto-imports/module'
import { distDir, pkgDir } from '../dirs'
import { version } from '../../package.json'
import { initNitro } from './nitro'
import { addModuleTranspiles } from './modules'

export function createNuxt (options: NuxtOptions): Nuxt {
  const hooks = createHooks<NuxtHooks>()

  const nuxt: Nuxt = {
    _version: version,
    options,
    hooks,
    callHook: hooks.callHook,
    addHooks: hooks.addHooks,
    hook: hooks.hook,
    ready: () => initNuxt(nuxt),
    close: () => Promise.resolve(hooks.callHook('close', nuxt)),
    vfs: {}
  }

  return nuxt
}

async function initNuxt (nuxt: Nuxt) {
  // Register user hooks
  nuxt.hooks.addHooks(nuxt.options.hooks)

  // Set nuxt instance for useNuxt
  nuxtCtx.set(nuxt)
  nuxt.hook('close', () => nuxtCtx.unset())

  // Init nitro
  await initNitro(nuxt)

  // Add nuxt3 types
  nuxt.hook('prepare:types', (opts) => {
    opts.references.push({ types: 'nuxt3' })
    opts.references.push({ path: resolve(nuxt.options.buildDir, 'plugins.d.ts') })
  })

  // Init user modules
  await nuxt.callHook('modules:before', { nuxt } as ModuleContainer)
  const modulesToInstall = [
    ...nuxt.options.buildModules,
    ...nuxt.options.modules,
    ...nuxt.options._modules
  ]

  // Add <NuxtWelcome>
  addComponent({
    name: 'NuxtWelcome',
    filePath: resolve(nuxt.options.appDir, 'components/nuxt-welcome.vue')
  })

  // Add <ClientOnly>
  addComponent({
    name: 'ClientOnly',
    filePath: resolve(nuxt.options.appDir, 'components/client-only')
  })

  for (const m of modulesToInstall) {
    const inlineOptions = Array.isArray(m) ? m[1] : {}
    await installModule(m, inlineOptions, nuxt)
  }

  await nuxt.callHook('modules:done', { nuxt } as ModuleContainer)

  await addModuleTranspiles()

  await nuxt.callHook('ready', nuxt)
}

export async function loadNuxt (opts: LoadNuxtOptions): Promise<Nuxt> {
  const options = await loadNuxtConfig(opts)

  // Temporary until finding better placement for each
  options.appDir = options.alias['#app'] = resolve(distDir, 'app')
  options._majorVersion = 3
  options.buildModules.push(pagesModule, metaModule, componentsModule, autoImportsModule)
  options.modulesDir.push(resolve(pkgDir, 'node_modules'))
  options.alias['vue-demi'] = resolve(options.appDir, 'compat/vue-demi')
  options.alias['@vue/composition-api'] = resolve(options.appDir, 'compat/capi')

  const nuxt = createNuxt(options)

  if (opts.ready !== false) {
    await nuxt.ready()
  }

  return nuxt
}

export function defineNuxtConfig (config: NuxtConfig): NuxtConfig {
  return config
}

// For a convenience import together with `defineNuxtConfig`
export type { NuxtConfig }
