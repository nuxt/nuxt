import { performance } from 'node:perf_hooks'
import { defu } from 'defu'
import { applyDefaults } from 'untyped'
import type { ModuleDefinition, ModuleOptions, ModuleSetupReturn, Nuxt, NuxtModule, NuxtOptions } from '@nuxt/schema'
import { logger } from '../logger'
import { tryUseNuxt, useNuxt } from '../context'
import { checkNuxtCompatibility } from '../compatibility'

/**
 * Define a Nuxt module, automatically merging defaults with user provided options, installing
 * any hooks that are provided, and calling an optional setup function for full control.
 */
export function defineNuxtModule<OptionsT extends ModuleOptions> (definition: ModuleDefinition<OptionsT> | NuxtModule<OptionsT>): NuxtModule<OptionsT> {
  if (typeof definition === 'function') { return defineNuxtModule({ setup: definition }) }

  // Normalize definition and meta
  const module: ModuleDefinition<OptionsT> & Required<Pick<ModuleDefinition<OptionsT>, 'meta'>> = defu(definition, { meta: {} })
  if (module.meta.configKey === undefined) {
    module.meta.configKey = module.meta.name
  }

  // Resolves module options from inline options, [configKey] in nuxt.config, defaults and schema
  async function getOptions (inlineOptions?: OptionsT, nuxt: Nuxt = useNuxt()) {
    const configKey = module.meta.configKey || module.meta.name!
    const _defaults = module.defaults instanceof Function ? module.defaults(nuxt) : module.defaults
    let _options = defu(inlineOptions, nuxt.options[configKey as keyof NuxtOptions], _defaults) as OptionsT
    if (module.schema) {
      _options = await applyDefaults(module.schema, _options) as OptionsT
    }
    return Promise.resolve(_options)
  }

  // Module format is always a simple function
  async function normalizedModule (this: any, inlineOptions: OptionsT, nuxt: Nuxt) {
    if (!nuxt) {
      nuxt = tryUseNuxt() || this.nuxt /* invoked by nuxt 2 */
    }

    // Avoid duplicate installs
    const uniqueKey = module.meta.name || module.meta.configKey
    if (uniqueKey) {
      nuxt.options._requiredModules = nuxt.options._requiredModules || {}
      if (nuxt.options._requiredModules[uniqueKey]) {
        return false
      }
      nuxt.options._requiredModules[uniqueKey] = true
    }

    // Check compatibility constraints
    if (module.meta.compatibility) {
      const issues = await checkNuxtCompatibility(module.meta.compatibility, nuxt)
      if (issues.length) {
        logger.warn(`Module \`${module.meta.name}\` is disabled due to incompatibility issues:\n${issues.toString()}`)
        return
      }
    }

    // Resolve module and options
    const _options = await getOptions(inlineOptions, nuxt)

    // Register hooks
    if (module.hooks) {
      nuxt.hooks.addHooks(module.hooks)
    }

    // Call setup
    const key = `nuxt:module:${uniqueKey || (Math.round(Math.random() * 10000))}`
    const mark = performance.mark(key)
    const res = await module.setup?.call(null as any, _options, nuxt) ?? {}
    const perf = performance.measure(key, mark.name)
    const setupTime = Math.round((perf.duration * 100)) / 100

    // Measure setup time
    if (setupTime > 5000 && uniqueKey !== '@nuxt/telemetry') {
      logger.warn(`Slow module \`${uniqueKey || '<no name>'}\` took \`${setupTime}ms\` to setup.`)
    } else if (nuxt.options.debug) {
      logger.info(`Module \`${uniqueKey || '<no name>'}\` took \`${setupTime}ms\` to setup.`)
    }

    // Check if module is ignored
    if (res === false) { return false }

    // Return module install result
    return defu(res, <ModuleSetupReturn> {
      timings: {
        setup: setupTime,
      },
    })
  }

  // Define getters for options and meta
  normalizedModule.getMeta = () => Promise.resolve(module.meta)
  normalizedModule.getOptions = getOptions

  return normalizedModule as NuxtModule<OptionsT>
}
