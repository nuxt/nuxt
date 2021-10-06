import { resolve } from 'pathe'
import { createHooks } from 'hookable'
import { loadNuxtConfig, LoadNuxtOptions, Nuxt, NuxtOptions, NuxtConfig, nuxtCtx, installModule, ModuleContainer, NuxtHooks } from '@nuxt/kit'
import pagesModule from '../pages/module'
import metaModule from '../meta/module'
import componentsModule from '../components/module'
import globalImportsModule from '../global-imports/module'
import { distDir, pkgDir } from '../dirs'
import { version } from '../../package.json'
import { initNitro } from './nitro'

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

  // Init user modules
  await nuxt.callHook('modules:before', { nuxt } as ModuleContainer)
  const modulesToInstall = [
    ...nuxt.options.buildModules,
    ...nuxt.options.modules,
    ...nuxt.options._modules
  ]

  for (const m of modulesToInstall) {
    await installModule(nuxt, m)
  }

  await nuxt.callHook('modules:done', { nuxt } as ModuleContainer)

  await nuxt.callHook('ready', nuxt)
}

export async function loadNuxt (opts: LoadNuxtOptions): Promise<Nuxt> {
  const options = loadNuxtConfig(opts)

  // Temp
  options.appDir = options.alias['#app'] = resolve(distDir, 'app')
  options._majorVersion = 3
  options.buildModules.push(pagesModule, metaModule, componentsModule, globalImportsModule)
  options.modulesDir.push(resolve(pkgDir, 'node_modules'))

  const nuxt = createNuxt(options)

  if (opts.ready !== false) {
    await nuxt.ready()
  }

  return nuxt
}

export function defineNuxtConfig (config: NuxtConfig): NuxtConfig {
  return config
}
