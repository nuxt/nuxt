import path from 'upath'
import consola from 'consola'
import type { Nuxt, NuxtPluginTemplate, NuxtTemplate } from '../types/nuxt'
import { chainFn } from '../utils/task'
import { addTemplate, addPluginTemplate, addServerMiddleware } from './utils'
import { installModule } from './install'

/** Legacy ModuleContainer for backwards compatibility with existing Nuxt 2 modules. */
export function createModuleContainer (nuxt: Nuxt) {
  return {
    nuxt,
    options: nuxt.options,

    /**
     * Returns a resolved promise immediately.
     *
     * @deprecated
     */
    ready () {
      return Promise.resolve()
    },

    /** @deprecated */
    addVendor () {
      console.warn('addVendor has been deprecated and has no effect.')
    },

    /**
     * Renders given template using lodash template during build into the project buildDir (`.nuxt`).
     *
     * If a fileName is not provided or the template is string, target file name defaults to
     * [dirName].[fileName].[pathHash].[ext].
     */
    addTemplate,

    /**
     * Registers a plugin template and prepends it to the plugins[] array.
     *
     * Note: You can use mode or .client and .server modifiers with fileName option
     * to use plugin only in client or server side.
     *
     * If you choose to specify a fileName, you can configure a custom path for the
     * fileName too, so you can choose the folder structure inside .nuxt folder in
     * order to prevent name collisioning:
     *
     * @example
     * ```js
     * this.addPlugin({
     *   src: path.resolve(__dirname, 'templates/foo.js'),
     *   fileName: 'foo.server.js' // [optional] only include in server bundle
     * })
     * ```
     */
    addPlugin (pluginTemplate: NuxtPluginTemplate): NuxtPluginTemplate {
      return addPluginTemplate(pluginTemplate)
    },

    /** Register a custom layout. If its name is 'error' it will override the default error layout. */
    addLayout (tmpl: NuxtTemplate, name: string) {
      const { filename, src } = addTemplate(tmpl)
      const layoutName = name || path.parse(src).name
      const layout = nuxt.options.layouts[layoutName]

      if (layout) {
        consola.warn(`Duplicate layout registration, "${layoutName}" has been registered as "${layout}"`)
      }

      // Add to nuxt layouts
      nuxt.options.layouts[layoutName] = `./${filename}`

      // If error layout, set ErrorPage
      if (name === 'error') {
        this.addErrorLayout(filename)
      }
    },

    /**
     * Set the layout that will render Nuxt errors. It should already have been added via addLayout or addTemplate.
     *
     * @param dst - Path to layout file within the buildDir (`.nuxt/<dst>.vue`)
     */
    addErrorLayout (dst: string) {
      const relativeBuildDir = path.relative(nuxt.options.rootDir, nuxt.options.buildDir)
      nuxt.options.ErrorPage = `~/${relativeBuildDir}/${dst}`
    },

    /** Adds a new server middleware to the end of the server middleware array. */
    addServerMiddleware,

    /** Allows extending webpack build config by chaining `options.build.extend` function. */
    extendBuild (fn) {
      // @ts-ignore
      nuxt.options.build.extend = chainFn(nuxt.options.build.extend, fn)
    },

    /** Allows extending routes by chaining `options.build.extendRoutes` function. */
    extendRoutes (fn) {
      nuxt.options.router.extendRoutes = chainFn(nuxt.options.router.extendRoutes, fn)
    },

    /** `requireModule` is a shortcut for `addModule` */
    requireModule: installModule,

    /** Registers a module. moduleOpts can be a string or an array ([src, options]). */
    addModule: installModule
  }
}

export type ModuleContainer = ReturnType<typeof createModuleContainer>
