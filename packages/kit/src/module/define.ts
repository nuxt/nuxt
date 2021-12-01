import { promises as fsp } from 'fs'
import defu from 'defu'
import { applyDefaults } from 'untyped'
import consola from 'consola'
import { dirname } from 'pathe'
import type { Nuxt, NuxtTemplate, NuxtModule, LegacyNuxtModule, ModuleOptions } from '@nuxt/schema'
import { useNuxt, nuxtCtx } from '../context'
import { isNuxt2, checkNuxtCompatibilityIssues } from '../compatibility'
import { templateUtils, compileTemplate } from '../internal/template'

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
      if (isNuxt2(nuxt)) {
        nuxt.addHooks(mod.hooks)
      } else {
        nuxt.hooks.addHooks(mod.hooks)
      }
    }

    // Stop if no install provided
    if (typeof mod.setup !== 'function') {
      return
    }

    // check nuxt version range
    if (mod.requires) {
      const issues = checkNuxtCompatibilityIssues(mod.requires, nuxt)
      if (issues.length) {
        consola.warn(`Module \`${mod.name}\` is disabled due to incompatibility issues:\n${issues.toString()}`)
        return
      }
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

    if (isNuxt2()) {
      // Support virtual templates with getContents() by writing them to .nuxt directory
      let virtualTemplates: NuxtTemplate[]
      nuxt.hook('builder:prepared', (_builder, buildOptions) => {
        virtualTemplates = buildOptions.templates.filter(t => t.getContents)
        for (const template of virtualTemplates) {
          buildOptions.templates.splice(buildOptions.templates.indexOf(template), 1)
        }
      })
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

    // Call setup
    return mod.setup.call(null, resolvedOptions, nuxt)
  }

  wrappedModule.meta = mod

  return wrappedModule
}
