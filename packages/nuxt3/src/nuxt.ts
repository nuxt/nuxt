import Hookable from 'hookable'
import { loadNuxtConfig, LoadNuxtConfigOptions, Nuxt, NuxtOptions, installModule } from '@nuxt/kit'
import { initNitro } from './nitro'

export function createNuxt (options: NuxtOptions): Nuxt {
  const hooks = new Hookable()

  return {
    options,
    hooks,
    callHook: hooks.callHook,
    hook: hooks.hook
  }
}

async function initNuxt (nuxt: Nuxt) {
  // Register user hooks
  nuxt.hooks.addHooks(nuxt.options.hooks)

  // Init nitro
  await initNitro(nuxt)

  // Init user modules
  await nuxt.callHook('modules:before', nuxt)
  const modulesToInstall = [
    ...nuxt.options.buildModules,
    ...nuxt.options.modules,
    ...nuxt.options._modules
  ]

  for (const m of modulesToInstall) {
    await installModule(nuxt, m)
  }

  await nuxt.callHook('modules:done', nuxt)

  await nuxt.callHook('ready', nuxt)
}

export interface LoadNuxtOptions extends LoadNuxtConfigOptions {
  for?: 'dev' | 'build'
}

export async function loadNuxt (loadOpts: LoadNuxtOptions = {}): Promise<Nuxt> {
  const options = loadNuxtConfig({
    config: {
      dev: loadOpts.for === 'dev',
      ...loadOpts.config
    },
    ...loadOpts
  })

  // Temp
  const { appDir } = await import('@nuxt/app/meta')
  options.appDir = appDir
  options._majorVersion = 3

  const nuxt = createNuxt(options)

  await initNuxt(nuxt)

  return nuxt
}
