import path from 'path'
import fs from 'fs'
import hash from 'hash-sum'
import consola from 'consola'

import { chainFn, sequence } from 'nuxt/utils'

import Nuxt from './nuxt'

interface Module {
  src: string
  options: Record<string, any>
  handler: () => any
}

interface Template {

}

export default class ModuleContainer {
  nuxt: Nuxt
  options: Nuxt['options']
  requiredModules: Record<string, Module>

  constructor (nuxt: Nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options
    this.requiredModules = {}

    // Self bind to allow destructre from container
    for (const method of Object.getOwnPropertyNames(ModuleContainer.prototype)) {
      if (typeof this[method] === 'function') {
        this[method] = this[method].bind(this)
      }
    }
  }

  async ready () {
    // Call before hook
    await this.nuxt.callHook('modules:before', this, this.options.modules)

    if (this.options.buildModules && !this.options._start) {
      // Load every devModule in sequence
      await sequence(this.options.buildModules, this.addModule)
    }

    // Load every module in sequence
    await sequence(this.options.modules, this.addModule)

    // Load ah-hoc modules last
    await sequence(this.options._modules, this.addModule)

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

    // Mostly for DX, some people prefers `filename` vs `fileName`
    const fileName = template.fileName || template.filename
    // Generate unique and human readable dst filename if not provided
    const dst = fileName || `${path.basename(srcPath.dir)}.${srcPath.name}.${hash(src)}${srcPath.ext}`
    // Add to templates list
    const templateObj = {
      src,
      dst,
      options: template.options
    }

    this.options.build.templates.push(templateObj)

    return templateObj
  }

  addPlugin (template) {
    const { dst } = this.addTemplate(template)

    // Add to nuxt plugins
    this.options.plugins.unshift({
      src: path.join(this.options.buildDir, dst),
      // TODO: remove deprecated option in Nuxt 3
      ssr: template.ssr,
      mode: template.mode
    })
  }

  addLayout (template, name: string) {
    const { dst, src } = this.addTemplate(template)
    const layoutName = name || path.parse(src).name
    const layout = this.options.layouts[layoutName]

    if (layout) {
      consola.warn(`Duplicate layout registration, "${layoutName}" has been registered as "${layout}"`)
    }

    // Add to nuxt layouts
    this.options.layouts[layoutName] = `./${dst}`

    // If error layout, set ErrorPage
    if (name === 'error') {
      this.addErrorLayout(dst)
    }
  }

  addErrorLayout (dst: string) {
    const relativeBuildDir = path.relative(this.options.rootDir, this.options.buildDir)
    this.options.ErrorPage = `~/${relativeBuildDir}/${dst}`
  }

  addServerMiddleware (middleware) {
    this.options.serverMiddleware.push(middleware)
  }

  extendBuild (fn) {
    this.options.build.extend = chainFn(this.options.build.extend, fn)
  }

  extendRoutes (fn) {
    this.options.router.extendRoutes = chainFn(
      this.options.router.extendRoutes,
      fn
    )
  }

  requireModule (moduleOpts: Module) {
    return this.addModule(moduleOpts)
  }

  async addModule (moduleOpts) {
    let src
    let options: Record<string, any>
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
    if (src instanceof Function) {
      handler = src
    }

    // Prevent adding buildModules-listed entries in production
    if (this.options.buildModules.includes(handler) && this.options._start) {
      return
    }

    // Resolve handler
    if (!handler) {
      try {
        handler = this.nuxt.resolver.requireModule(src, { useESM: true })
      } catch (error) {
        if (error.code !== 'MODULE_NOT_FOUND') {
          throw error
        }

        // Hint only if entrypoint is not found and src is not local alias or path
        if (error.message.includes(src) && !/^[~.]|^@\//.test(src)) {
          let message = 'Module `{name}` not found.'

          if (this.options.buildModules.includes(src)) {
            message += ' Please ensure `{name}` is in `devDependencies` and installed. HINT: During build step, for npm/yarn, `NODE_ENV=production` or `--production` should NOT be used.'.replace('{name}', src)
          } else if (this.options.modules.includes(src)) {
            message += ' Please ensure `{name}` is in `dependencies` and installed.'
          }

          message = message.replace(/{name}/g, src)

          consola.warn(message)
        }

        if (this.options._cli) {
          throw error
        } else {
          // TODO: Remove in next major version
          consola.warn('Silently ignoring module as programatic usage detected.')
          return
        }
      }
    }

    // Validate handler
    if (typeof handler !== 'function') {
      throw new TypeError('Module should export a function: ' + src)
    }

    // Ensure module is required once
    const metaKey = handler.meta && handler.meta.name
    const key = metaKey || src
    if (typeof key === 'string') {
      if (this.requiredModules[key]) {
        if (!metaKey) {
          // TODO: Skip with nuxt3
          consola.warn('Modules should be only specified once:', key)
        } else {
          return
        }
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
