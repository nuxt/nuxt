import path from 'path'
import fs from 'fs'
import hash from 'hash-sum'
import consola from 'consola'

import type { NormalizedConfiguration } from 'nuxt/config'
import { chainFn, Mode, sequence } from 'nuxt/utils'

import Nuxt from './nuxt'
import type { NuxtModule, ModuleHandler } from 'nuxt/config/config/_common'

interface TemplateInput {
  filename?: string
  fileName?: string
  options?: Record<string, any>
  src: string
  ssr?: boolean
  mode?: 'all' | 'server' | 'client'
}

export default class ModuleContainer {
  nuxt: Nuxt
  options: Nuxt['options']
  requiredModules: Record<string, {
    src: string
    options: Record<string, any>
    handler: ModuleHandler
  }>

  constructor(nuxt: Nuxt) {
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

  async ready() {
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

  addVendor() {
    consola.warn('addVendor has been deprecated due to webpack4 optimization')
  }

  addTemplate(template: TemplateInput | string) {
    if (!template) {
      throw new Error('Invalid template: ' + JSON.stringify(template))
    }

    // Validate & parse source
    const src = typeof template === 'string' ? template : template.src
    const srcPath = path.parse(src)

    if (typeof src !== 'string' || !fs.existsSync(src)) {
      throw new Error('Template src not found: ' + src)
    }

    // Mostly for DX, some people prefers `filename` vs `fileName`
    const fileName = typeof template === 'string' ? '' : template.fileName || template.filename
    // Generate unique and human readable dst filename if not provided
    const dst = fileName || `${path.basename(srcPath.dir)}.${srcPath.name}.${hash(src)}${srcPath.ext}`
    // Add to templates list
    const templateObj = {
      src,
      dst,
      options: typeof template === 'string' ? undefined : template.options
    }

    this.options.build.templates.push(templateObj)

    return templateObj
  }

  addPlugin(template: TemplateInput) {
    const { dst } = this.addTemplate(template)

    // Add to nuxt plugins
    this.options.plugins.unshift({
      src: path.join(this.options.buildDir, dst),
      // TODO: remove deprecated option in Nuxt 3
      ssr: template.ssr,
      mode: template.mode
    })
  }

  addLayout(template: TemplateInput, name: string) {
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

  addErrorLayout(dst: string) {
    const relativeBuildDir = path.relative(this.options.rootDir, this.options.buildDir)
    this.options.ErrorPage = `~/${relativeBuildDir}/${dst}`
  }

  addServerMiddleware(middleware: NormalizedConfiguration['serverMiddleware'][number]) {
    this.options.serverMiddleware.push(middleware)
  }

  extendBuild(fn: NormalizedConfiguration['build']['extend']) {
    this.options.build.extend = chainFn(this.options.build.extend, fn)
  }

  extendRoutes(fn: NormalizedConfiguration['router']['extendRoutes']) {
    this.options.router.extendRoutes = chainFn(
      this.options.router.extendRoutes,
      fn
    )
  }

  requireModule(moduleOpts: NuxtModule) {
    return this.addModule(moduleOpts)
  }

  async addModule(moduleOpts: NuxtModule) {
    let src: string | ModuleHandler
    let options: Record<string, any>
    let handler: ModuleHandler | ModuleHandler & { meta: { name: string } }

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
    if (!handler && typeof src === 'string') {
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
    if ('meta' in handler && typeof src === 'string') {
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
        this.requiredModules[key] = { src, options, handler: handler as ModuleHandler }
      }
    }

    // Default module options to empty object
    if (options === undefined) {
      options = {}
    }
    const result = await handler.call(this, options)
    return result
  }
}
