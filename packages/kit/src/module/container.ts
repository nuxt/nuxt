import { nuxtCtx } from '../nuxt'
import { installModule } from './install'
import {
  addTemplate,
  addErrorLayout,
  addLayout,
  addPlugin,
  addServerMiddleware,
  extendBuild,
  extendRoutes
} from './utils'
import type { Nuxt } from '../types/nuxt'
import type { NuxtOptions } from '../types/config'
import type { TemplateOpts, PluginTemplateOpts } from '../types/module'

/** Legacy ModuleContainer for backwards compatibility with existing Nuxt 2 modules. */
export class ModuleContainer {
  nuxt: Nuxt
  options: NuxtOptions

  constructor (nuxt: Nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options
  }

  private _call<F extends (...args: any) => any>(fn: F, ...args: Parameters<F>): ReturnType<F> {
    // @ts-ignore
    return nuxtCtx.call(this.nuxt, () => fn(...args))
  }

  /**
   * Returns a resolved promise immediately.
   *
   * @deprecated
   */
  ready () {
    return Promise.resolve()
  }

  /** @deprecated */
  addVendor () {
    console.warn('addVendor has been deprecated and has no effect.')
  }

  /**
   * Renders given template using lodash template during build into the project buildDir (`.nuxt`).
   *
   * If a fileName is not provided or the template is string, target file name defaults to
   * [dirName].[fileName].[pathHash].[ext].
   */
  addTemplate (tmpl: TemplateOpts | string) {
    return this._call(addTemplate, tmpl)
  }

  /**
   * Registers a plugin using `addTemplate` and prepends it to the plugins[] array.
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
  addPlugin (tmpl: PluginTemplateOpts) {
    return this._call(addPlugin, tmpl)
  }

  /** Register a custom layout. If its name is 'error' it will override the default error layout. */
  addLayout (tmpl: TemplateOpts, name: string) {
    return this._call(addLayout, tmpl, name)
  }

  /**
   * Set the layout that will render Nuxt errors. It should already have been added via addLayout or addTemplate.
   *
   * @param dst - Path to layout file within the buildDir (`.nuxt/<dst>.vue`)
   */
  addErrorLayout (dst: string) {
    return this._call(addErrorLayout, dst)
  }

  /** Adds a new server middleware to the end of the server middleware array. */
  addServerMiddleware (middleware) {
    return this._call(addServerMiddleware, middleware)
  }

  /** Allows extending webpack build config by chaining `options.build.extend` function. */
  extendBuild (fn) {
    return this._call(extendBuild, fn)
  }

  /** Allows extending routes by chaining `options.build.extendRoutes` function. */
  extendRoutes (fn) {
    return this._call(extendRoutes, fn)
  }

  /** `requireModule` is a shortcut for `addModule` */
  requireModule (moduleOpts: string | [src: string, options: any]) {
    return installModule(this.nuxt, moduleOpts)
  }

  /** Registers a module. moduleOpts can be a string or an array ([src, options]). */
  addModule (moduleOpts: string | [src: string, options: any]) {
    return installModule(this.nuxt, moduleOpts)
  }
}
