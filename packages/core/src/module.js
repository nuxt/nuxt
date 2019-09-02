import path from 'path'
import fs from 'fs'
import hash from 'hash-sum'
import consola from 'consola'

import { chainFn, sequence } from '@nuxt/utils'

export default class ModuleContainer {
  constructor (nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options
    this.requiredModules = {}
  }

  async ready () {
    // Call before hook
    await this.nuxt.callHook('modules:before', this, this.nuxt.options.modules)

    if (this.nuxt.options.buildModules && !this.nuxt.options._start) {
      // Load every devModule in sequence
      await sequence(this.nuxt.options.buildModules, this.addModule.bind(this))
    }

    // Load every module in sequence
    await sequence(this.nuxt.options.modules, this.addModule.bind(this))

    // Call done hook
    await this.nuxt.callHook('modules:done', this)
  }

  addVendor () {
    consola.warn('addVendor has been deprecated due to webpack4 optimization')
  }

  addTemplate (template) {
    if (!template) {
      throw new Error('Invalid template: ' + JSON.stringify(template))
    }

    // Validate & parse source
    const src = template.src || template
    const srcPath = path.parse(src)

    if (typeof src !== 'string' || !fs.existsSync(src)) {
      throw new Error('Template src not found: ' + src)
    }

    // Generate unique and human readable dst filename
    const dst =
      template.fileName ||
      path.basename(srcPath.dir) + `.${srcPath.name}.${hash(src)}` + srcPath.ext

    // Add to templates list
    const templateObj = {
      src,
      dst,
      options: template.options
    }

    this.nuxt.options.build.templates.push(templateObj)
    return templateObj
  }

  addPlugin (template) {
    const { dst } = this.addTemplate(template)

    // Add to nuxt plugins
    this.nuxt.options.plugins.unshift({
      src: path.join(this.nuxt.options.buildDir, dst),
      // TODO: remove deprecated option in Nuxt 3
      ssr: template.ssr,
      mode: template.mode
    })
  }

  addLayout (template, name) {
    const { dst, src } = this.addTemplate(template)
    const layoutName = name || path.parse(src).name
    const layout = this.nuxt.options.layouts[layoutName]

    if (layout) {
      consola.warn(`Duplicate layout registration, "${layoutName}" has been registered as "${layout}"`)
    }

    // Add to nuxt layouts
    this.nuxt.options.layouts[layoutName] = `./${dst}`

    // If error layout, set ErrorPage
    if (name === 'error') {
      this.addErrorLayout(dst)
    }
  }

  addErrorLayout (dst) {
    const relativeBuildDir = path.relative(this.nuxt.options.rootDir, this.nuxt.options.buildDir)
    this.nuxt.options.ErrorPage = `~/${relativeBuildDir}/${dst}`
  }

  addServerMiddleware (middleware) {
    this.nuxt.options.serverMiddleware.push(middleware)
  }

  extendBuild (fn) {
    this.nuxt.options.build.extend = chainFn(this.nuxt.options.build.extend, fn)
  }

  extendRoutes (fn) {
    this.nuxt.options.router.extendRoutes = chainFn(
      this.nuxt.options.router.extendRoutes,
      fn
    )
  }

  requireModule (moduleOpts) {
    return this.addModule(moduleOpts, true /* require once */)
  }

  async addModule (moduleOpts, requireOnce) {
    let src
    let options
    let handler

    // Type 1: String or Function
    if (typeof moduleOpts === 'string' || typeof moduleOpts === 'function') {
      src = moduleOpts
    } else if (Array.isArray(moduleOpts)) {
      // Type 2: Babel style array
      [src, options] = moduleOpts
    } else if (typeof moduleOpts === 'object') {
      // Type 3: Pure object
      ({ src, options, handler } = moduleOpts)
    }

    // Define handler if src is a function
    if (typeof src === 'function') {
      handler = src
    }

    // Prevent adding buildModules-listed entries in production
    if (this.nuxt.options.buildModules.includes(handler) && this.nuxt.options._start) {
      return
    }

    // Resolve handler
    if (!handler) {
      handler = this.nuxt.resolver.requireModule(src, { useESM: true })
    }

    // Validate handler
    if (typeof handler !== 'function') {
      throw new TypeError('Module should export a function: ' + src)
    }

    // Resolve module meta
    let key = (handler.meta && handler.meta.name) || handler.name
    if (!key || key === 'default') {
      key = src
    }

    // Update requiredModules
    if (typeof key === 'string') {
      if (requireOnce && this.requiredModules[key]) {
        return
      }
      this.requiredModules[key] = { src, options, handler }
    }

    // Default module options to empty object
    if (options === undefined) {
      options = {}
    }
    const result = await handler.call(this, options)
    return result
  }
}
