import { normalize } from 'upath'
import Hookable from 'hookable'
import { loadNuxtConfig, LoadNuxtOptions, Nuxt, NuxtOptions, nuxtCtx, installModule, ModuleContainer } from '@nuxt/kit'
import { initNitro } from './nitro'

export function createNuxt (options: NuxtOptions): Nuxt {
  const hooks = new Hookable() as any as Nuxt['hooks']

  const nuxt: Nuxt = {
    options,
    hooks,
    callHook: hooks.callHook,
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
  const { appDir } = await import('@nuxt/app/meta')
  options.appDir = appDir
  options._majorVersion = 3
  options.buildModules.push(normalize(require.resolve('@nuxt/pages/module')))
  options.buildModules.push(normalize(require.resolve('@nuxt/meta/module')))
  options.buildModules.push(normalize(require.resolve('@nuxt/component-discovery/module')))

  const nuxt = createNuxt(options)

  if (opts.ready !== false) {
    await nuxt.ready()
  }

  return nuxt
}
