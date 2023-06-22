import { promises as fsp } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { defu } from 'defu'
import { applyDefaults } from 'untyped'
import { dirname } from 'pathe'
import type { ModuleDefinition, ModuleOptions, ModuleSetupReturn, Nuxt, NuxtModule, NuxtOptions, ResolvedNuxtTemplate } from '@nuxt/schema'
import { logger } from '../logger'
import { nuxtCtx, tryUseNuxt, useNuxt } from '../context'
import { checkNuxtCompatibility, isNuxt2 } from '../compatibility'
import { compileTemplate, templateUtils } from '../internal/template'

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

    // Prepare
    nuxt2Shims(nuxt)

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
    const perf = performance.measure(key, mark?.name) // TODO: remove when Node 14 reaches EOL
    const setupTime = perf ? Math.round((perf.duration * 100)) / 100 : 0 // TODO: remove when Node 14 reaches EOL

    // Measure setup time
    if (setupTime > 5000) {
      logger.warn(`Slow module \`${uniqueKey || '<no name>'}\` took \`${setupTime}ms\` to setup.`)
    } else if (nuxt.options.debug) {
      logger.info(`Module \`${uniqueKey || '<no name>'}\` took \`${setupTime}ms\` to setup.`)
    }

    // Check if module is ignored
    if (res === false) { return false }

    // Return module install result
    return defu(res, <ModuleSetupReturn> {
      timings: {
        setup: setupTime
      }
    })
  }

  // Define getters for options and meta
  normalizedModule.getMeta = () => Promise.resolve(module.meta)
  normalizedModule.getOptions = getOptions

  return normalizedModule as NuxtModule<OptionsT>
}

// -- Nuxt 2 compatibility shims --
const NUXT2_SHIMS_KEY = '__nuxt2_shims_key__'
function nuxt2Shims (nuxt: Nuxt) {
  // Avoid duplicate install and only apply to Nuxt2
  if (!isNuxt2(nuxt) || nuxt[NUXT2_SHIMS_KEY as keyof Nuxt]) { return }
  nuxt[NUXT2_SHIMS_KEY as keyof Nuxt] = true

  // Allow using nuxt.hooks
  // @ts-expect-error Nuxt 2 extends hookable
  nuxt.hooks = nuxt

  // Allow using useNuxt()
  if (!nuxtCtx.tryUse()) {
    nuxtCtx.set(nuxt)
    nuxt.hook('close', () => nuxtCtx.unset())
  }

  // Support virtual templates with getContents() by writing them to .nuxt directory
  let virtualTemplates: ResolvedNuxtTemplate[]
  // @ts-expect-error Nuxt 2 hook
  nuxt.hook('builder:prepared', (_builder, buildOptions) => {
    virtualTemplates = buildOptions.templates.filter((t: any) => t.getContents)
    for (const template of virtualTemplates) {
      buildOptions.templates.splice(buildOptions.templates.indexOf(template), 1)
    }
  })
  // @ts-expect-error Nuxt 2 hook
  nuxt.hook('build:templates', async (templates) => {
    const context = {
      nuxt,
      utils: templateUtils,
      app: {
        dir: nuxt.options.srcDir,
        extensions: nuxt.options.extensions,
        plugins: nuxt.options.plugins,
        templates: [
          ...templates.templatesFiles,
          ...virtualTemplates
        ],
        templateVars: templates.templateVars
      }
    }
    for await (const template of virtualTemplates) {
      const contents = await compileTemplate({ ...template, src: '' }, context)
      await fsp.mkdir(dirname(template.dst), { recursive: true })
      await fsp.writeFile(template.dst, contents)
    }
  })
}
