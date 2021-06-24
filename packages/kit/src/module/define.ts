import defu from 'defu'
import { applyDefaults } from 'untyped'
import { useNuxt, nuxtCtx } from '../nuxt'
import type { Nuxt } from '../types/nuxt'
import type { NuxtModule, LegacyNuxtModule, ModuleOptions } from '../types/module'

/**
 * Define a Nuxt module, automatically merging defaults with user provided options, installing
 * any hooks that are provided, and calling an optional setup function for full control.
 */
export function defineNuxtModule<OptionsT extends ModuleOptions> (input: NuxtModule<OptionsT> | ((nuxt: Nuxt) => NuxtModule<OptionsT>)): LegacyNuxtModule {
  let mod: NuxtModule<OptionsT>

  function wrappedModule (inlineOptions: OptionsT) {
    // Get nuxt context
    const nuxt: Nuxt = this.nuxt || useNuxt()

    // Resolve function
    if (typeof input === 'function') {
      mod = input(nuxt)
    } else {
      mod = input
    }

    // Install hooks
    if (mod.hooks) {
      nuxt.hooks.addHooks(mod.hooks)
    }

    // Stop if no install provided
    if (typeof mod.setup !== 'function') {
      return
    }

    // Resolve options
    const configKey = mod.configKey || mod.name
    const userOptions = defu(inlineOptions, nuxt.options[configKey]) as OptionsT
    const resolvedOptions = applyDefaults(mod.defaults as any, userOptions) as OptionsT

    // Ensure nuxt instance exists (nuxt2 compatibility)
    if (!nuxtCtx.use()) {
      nuxtCtx.set(nuxt)
      // @ts-ignore
      if (!nuxt.__nuxtkit_close__) {
        nuxt.hook('close', () => nuxtCtx.unset())
        // @ts-ignore
        nuxt.__nuxtkit_close__ = true
      }
    }

    // Call setup
    return mod.setup.call(null, resolvedOptions, nuxt)
  }

  wrappedModule.meta = mod

  return wrappedModule
}
