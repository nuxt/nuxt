import type { Nuxt } from '../types/nuxt'
import type { NuxtOptions } from '../types/config'
import type { TemplateOpts, PluginTemplateOpts } from '../types/module'
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

  ready () {
    return Promise.resolve()
  }

  addVendor () {
    console.warn('addVendor has been deprecated')
  }

  addTemplate (tmpl: TemplateOpts | string) {
    return this._call(addTemplate, tmpl)
  }

  addPlugin (tmpl: PluginTemplateOpts) {
    return this._call(addPlugin, tmpl)
  }

  addLayout (tmpl: TemplateOpts, name: string) {
    return this._call(addLayout, tmpl, name)
  }

  addErrorLayout (dst: string) {
    return this._call(addErrorLayout, dst)
  }

  addServerMiddleware (middleware) {
    return this._call(addServerMiddleware, middleware)
  }

  extendBuild (fn) {
    return this._call(extendBuild, fn)
  }

  extendRoutes (fn) {
    return this._call(extendRoutes, fn)
  }

  requireModule (moduleOpts) {
    return installModule(this.nuxt, moduleOpts)
  }

  addModule (moduleOpts) {
    return installModule(this.nuxt, moduleOpts)
  }
}
