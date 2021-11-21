import { parse, relative } from 'pathe'
import consola from 'consola'
import type { Nuxt, NuxtPluginTemplate, NuxtTemplate, ModuleContainer } from '@nuxt/schema'
import { chainFn } from '../internal/task'
import { addTemplate } from '../template'
import { addServerMiddleware } from '../server'
import { isNuxt2 } from '../compatibility'
import { addPluginTemplate } from '../plugin'

import { installModule } from './install'

export function createModuleContainer (nuxt: Nuxt): ModuleContainer {
  return <ModuleContainer>{
    nuxt,
    options: nuxt.options,

    ready () { return Promise.resolve() },
    addVendor () {},

    requireModule: installModule,
    addModule: installModule,

    addServerMiddleware,

    addTemplate (template: string | NuxtTemplate) {
      if (typeof template === 'string') {
        template = { src: template }
      }
      if (template.write === undefined) {
        template.write = true
      }
      return addTemplate(template)
    },

    addPlugin (pluginTemplate: NuxtPluginTemplate): NuxtPluginTemplate {
      return addPluginTemplate(pluginTemplate)
    },

    addLayout (tmpl: NuxtTemplate, name: string) {
      const { filename, src } = addTemplate(tmpl)
      const layoutName = name || parse(src).name
      const layout = nuxt.options.layouts[layoutName]

      if (layout) {
        consola.warn(`Duplicate layout registration, "${layoutName}" has been registered as "${layout}"`)
      }
      nuxt.options.layouts[layoutName] = `./${filename}`
      if (name === 'error') {
        this.addErrorLayout(filename)
      }
    },

    addErrorLayout (dst: string) {
      const relativeBuildDir = relative(nuxt.options.rootDir, nuxt.options.buildDir)
      nuxt.options.ErrorPage = `~/${relativeBuildDir}/${dst}`
    },

    extendBuild (fn) {
      // @ts-ignore
      nuxt.options.build.extend = chainFn(nuxt.options.build.extend, fn)
    },

    extendRoutes (fn) {
      if (isNuxt2(nuxt)) {
        nuxt.options.router.extendRoutes = chainFn(nuxt.options.router.extendRoutes, fn)
      } else {
        nuxt.hook('pages:extend', async (pages, ...args) => {
          const maybeRoutes = await fn(pages, ...args)
          if (maybeRoutes) {
            console.warn('[kit] [compat] Using `extendRoutes` in Nuxt 3 needs to directly modify first argument instead of returning updated routes. Skipping extended routes.')
          }
        })
      }
    }
  }
}
