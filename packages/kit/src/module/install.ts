import type { Nuxt } from '../types/nuxt'
import type { LegacyNuxtModule, NuxtModule, ModuleMeta, ModuleInstallOptions, ModuleOptions, ModuleSrc } from '../types/module'
import { requireModule } from '../utils/cjs'
import { nuxtCtx } from '../nuxt'
import { defineNuxtModule } from './define'
import { ModuleContainer } from './container'

export async function installModule (nuxt: Nuxt, installOpts: ModuleInstallOptions) {
  let src: ModuleSrc
  let options: ModuleOptions = {}
  const meta: ModuleMeta = {}

  // Extract src, meta and options
  if (typeof installOpts === 'string') {
    src = installOpts
  } else if (Array.isArray(installOpts)) {
    [src, options] = installOpts
  } else if (typeof installOpts === 'object') {
    if (installOpts.src || installOpts.handler) {
      src = installOpts.src || installOpts.handler
      options = installOpts.options
      Object.assign(meta, installOpts.meta)
    } else {
      src = installOpts as NuxtModule
    }
  } else {
    src = installOpts
  }

  // Resolve as legacy handler
  let handler: LegacyNuxtModule
  if (typeof src === 'string') {
    handler = requireModule(src)
    if (!meta.name) {
      meta.name = src
    }
  } else if (typeof src === 'function') {
    handler = src
  } else {
    handler = defineNuxtModule(src)
  }

  // Merge meta
  if (handler.meta) {
    Object.assign(meta, handler.meta)
  }

  // Ensure module is required once
  if (typeof meta.name === 'string') {
    nuxt.options._requiredModules = nuxt.options._requiredModules || {}
    if (nuxt.options._requiredModules[meta.name]) {
      return
    }
    nuxt.options._requiredModules[meta.name] = true
  }

  // Execute in legacy container
  const container = new ModuleContainer(nuxt)
  await nuxtCtx.call(nuxt, () => handler.call(container, options))
}
