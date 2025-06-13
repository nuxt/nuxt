import { performance } from 'node:perf_hooks'
import { defu } from 'defu'
import { applyDefaults } from 'untyped'
import type { ModuleDefinition, ModuleOptions, ModuleSetupInstallResult, ModuleSetupReturn, Nuxt, NuxtModule, NuxtOptions, ResolvedModuleOptions } from '@nuxt/schema'
import { logger } from '../logger'
import { tryUseNuxt, useNuxt } from '../context'
import { checkNuxtCompatibility } from '../compatibility'

/**
 * Define a Nuxt module, automatically merging defaults with user provided options, installing
 * any hooks that are provided, and calling an optional setup function for full control.
 */
export function defineNuxtModule<TOptions extends ModuleOptions> (
  definition: ModuleDefinition<TOptions, Partial<TOptions>, false> | NuxtModule<TOptions, Partial<TOptions>, false>
): NuxtModule<TOptions, TOptions, false>

export function defineNuxtModule<TOptions extends ModuleOptions> (): {
  with: <TOptionsDefaults extends Partial<TOptions>> (
    definition: ModuleDefinition<TOptions, TOptionsDefaults, true> | NuxtModule<TOptions, TOptionsDefaults, true>
  ) => NuxtModule<TOptions, TOptionsDefaults, true>
}

export function defineNuxtModule<TOptions extends ModuleOptions> (
  definition?: ModuleDefinition<TOptions, Partial<TOptions>, false> | NuxtModule<TOptions, Partial<TOptions>, false>,
) {
  if (definition) {
    return _defineNuxtModule(definition)
  }

  return {
    with: <TOptionsDefaults extends Partial<TOptions>>(
      definition: ModuleDefinition<TOptions, TOptionsDefaults, true> | NuxtModule<TOptions, TOptionsDefaults, true>,
    ) => _defineNuxtModule(definition),
  }
}

function _defineNuxtModule<
  TOptions extends ModuleOptions,
  TOptionsDefaults extends Partial<TOptions>,
  TWith extends boolean,
> (
  definition: ModuleDefinition<TOptions, TOptionsDefaults, TWith> | NuxtModule<TOptions, TOptionsDefaults, TWith>,
): NuxtModule<TOptions, TOptionsDefaults, TWith> {
  if (typeof definition === 'function') {
    return _defineNuxtModule<TOptions, TOptionsDefaults, TWith>({ setup: definition })
  }

  // Normalize definition and meta
  const module: ModuleDefinition<TOptions, TOptionsDefaults, TWith> & Required<Pick<ModuleDefinition<TOptions, TOptionsDefaults, TWith>, 'meta'>> = defu(definition, { meta: {} })

  module.meta.configKey ||= module.meta.name

  // Resolves module options from inline options, [configKey] in nuxt.config, defaults and schema
  async function getOptions (inlineOptions?: Partial<TOptions>, nuxt: Nuxt = useNuxt()): Promise<
    TWith extends true
      ? ResolvedModuleOptions<TOptions, TOptionsDefaults>
      : TOptions
  > {
    const nuxtConfigOptionsKey = module.meta.configKey || module.meta.name

    const nuxtConfigOptions: Partial<TOptions> = nuxtConfigOptionsKey && nuxtConfigOptionsKey in nuxt.options ? nuxt.options[nuxtConfigOptionsKey as keyof NuxtOptions] as Partial<TOptions> : {}

    const optionsDefaults: TOptionsDefaults =
      module.defaults instanceof Function
        ? await module.defaults(nuxt)
        : module.defaults ?? <TOptionsDefaults> {}

    let options = defu(inlineOptions, nuxtConfigOptions, optionsDefaults)

    if (module.schema) {
      options = await applyDefaults(module.schema, options) as any
    }

    // @ts-expect-error ignore type mismatch when calling `defineNuxtModule` without `.with()`
    return Promise.resolve(options)
  }

  // Module format is always a simple function
  async function normalizedModule (inlineOptions: Partial<TOptions>, nuxt = tryUseNuxt()!): Promise<ModuleSetupReturn> {
    if (!nuxt) {
      throw new TypeError('Cannot use module outside of Nuxt context')
    }

    // Avoid duplicate installs
    const uniqueKey = module.meta.name || module.meta.configKey
    if (uniqueKey) {
      nuxt.options._requiredModules ||= {}
      if (nuxt.options._requiredModules[uniqueKey]) {
        return false
      }
      nuxt.options._requiredModules[uniqueKey] = true
    }

    // Check compatibility constraints
    if (module.meta.compatibility) {
      const issues = await checkNuxtCompatibility(module.meta.compatibility, nuxt)
      if (issues.length) {
        const errorMessage = `Module \`${module.meta.name}\` is disabled due to incompatibility issues:\n${issues.toString()}`
        if (nuxt.options.experimental.enforceModuleCompatibility) {
          const error = new Error(errorMessage)
          error.name = 'ModuleCompatibilityError'
          throw error
        }
        logger.warn(errorMessage)
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
    const start = performance.now()
    const res = await module.setup?.call(null as any, _options, nuxt) ?? {}
    const perf = performance.now() - start
    const setupTime = Math.round((perf * 100)) / 100

    // Measure setup time
    if (setupTime > 5000 && uniqueKey !== '@nuxt/telemetry') {
      logger.warn(`Slow module \`${uniqueKey || '<no name>'}\` took \`${setupTime}ms\` to setup.`)
    } else if (nuxt.options.debug && nuxt.options.debug.modules) {
      logger.info(`Module \`${uniqueKey || '<no name>'}\` took \`${setupTime}ms\` to setup.`)
    }

    // Check if module is ignored
    if (res === false) { return false }

    // Return module install result
    return defu(res, <ModuleSetupInstallResult> {
      timings: {
        setup: setupTime,
      },
    })
  }

  // Define getters for options and meta
  normalizedModule.getMeta = () => Promise.resolve(module.meta)
  normalizedModule.getOptions = getOptions

  return <NuxtModule<TOptions, TOptionsDefaults, TWith>> normalizedModule
}
