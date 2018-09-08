import path from 'path'
import fs from 'fs'
import hash from 'hash-sum'
import consola from 'consola'
import { chainFn, sequence } from '../common/utils'

export default class ModuleContainer {
  constructor(nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options
    this.requiredModules = {}
  }

  async ready() {
    // Call before hook
    await this.nuxt.callHook('modules:before', this, this.options.modules)

    // Load every module in sequence
    await sequence(this.options.modules, this.addModule.bind(this))

    // Call done hook
    await this.nuxt.callHook('modules:done', this)
  }

  addVendor() {
    consola.warn('addVendor has been deprecated due to webpack4 optimization')
  }

  addTemplate(template) {
    /* istanbul ignore if */
    if (!template) {
      throw new Error('Invalid template:' + JSON.stringify(template))
    }

    // Validate & parse source
    const src = template.src || template
    const srcPath = path.parse(src)
    /* istanbul ignore if */
    if (typeof src !== 'string' || !fs.existsSync(src)) {
      throw new Error('Template src not found:' + src)
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

    this.options.build.templates.push(templateObj)
    return templateObj
  }

  addPlugin(template) {
    const { dst } = this.addTemplate(template)

    // Add to nuxt plugins
    this.options.plugins.unshift({
      src: path.join(this.options.buildDir, dst),
      ssr: template.ssr
    })
  }

  addLayout(template, name) {
    const { dst, src } = this.addTemplate(template)

    // Add to nuxt layouts
    this.options.layouts[name || path.parse(src).name] = `./${dst}`

    // If error layout, set ErrorPage
    if (name === 'error') {
      this.addErrorLayout(dst)
    }
  }

  addErrorLayout(dst) {
    const relativeBuildDir = path.relative(this.options.rootDir, this.options.buildDir)
    this.options.ErrorPage = `~/${relativeBuildDir}/${dst}`
  }

  addServerMiddleware(middleware) {
    this.options.serverMiddleware.push(middleware)
  }

  extendBuild(fn) {
    this.options.build.extend = chainFn(this.options.build.extend, fn)
  }

  extendRoutes(fn) {
    this.options.router.extendRoutes = chainFn(
      this.options.router.extendRoutes,
      fn
    )
  }

  requireModule(moduleOpts) {
    return this.addModule(moduleOpts, true /* require once */)
  }

  addModule(moduleOpts, requireOnce) {
    let src
    let options
    let handler

    // Type 1: String
    if (typeof moduleOpts === 'string') {
      src = moduleOpts
    } else if (Array.isArray(moduleOpts)) {
      // Type 2: Babel style array
      src = moduleOpts[0]
      options = moduleOpts[1]
    } else if (typeof moduleOpts === 'object') {
      // Type 3: Pure object
      src = moduleOpts.src
      options = moduleOpts.options
      handler = moduleOpts.handler
    }

    // Resolve handler
    if (!handler) {
      handler = this.nuxt.requireModule(src)
    }

    // Validate handler
    /* istanbul ignore if */
    if (typeof handler !== 'function') {
      throw new Error('Module should export a function: ' + src)
    }

    // Resolve module meta
    const key = (handler.meta && handler.meta.name) || handler.name || src

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

    return new Promise((resolve) => {
      // Call module with `this` context and pass options
      const result = handler.call(this, options)

      // If module send back a promise
      if (result && result.then) {
        return resolve(result)
      }

      // synchronous
      return resolve()
    })
  }
}
