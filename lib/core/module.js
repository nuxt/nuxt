import path from 'path'
import fs from 'fs'
import { uniq } from 'lodash'
import hash from 'hash-sum'
import { chainFn, sequence } from 'utils'
import Debug from 'debug'

const debug = Debug('nuxt:module')

export default class ModuleContainer {
  constructor(nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options
    this.requiredModules = []
  }

  async ready() {
    await this.nuxt.callHook('modules:before', this, this.options.modules)
    // Load every module in sequence
    await sequence(this.options.modules, this.addModule.bind(this))
    // Call done hook
    await this.nuxt.callHook('modules:done', this)
  }

  addVendor(vendor) {
    /* istanbul ignore if */
    if (!vendor) {
      return
    }
    this.options.build.vendor = uniq(this.options.build.vendor.concat(vendor))
  }

  addTemplate(template) {
    /* istanbul ignore if */
    if (!template) {
      return
    }
    // Validate & parse source
    const src = template.src || template
    const srcPath = path.parse(src)
    /* istanbul ignore if */
    if (!src || typeof src !== 'string' || !fs.existsSync(src)) {
      /* istanbul ignore next */
      debug('[nuxt] invalid template', template)
      return
    }
    // Generate unique and human readable dst filename
    const dst = template.fileName ||
      (path.basename(srcPath.dir) + '.' + srcPath.name + '.' + hash(src) + srcPath.ext)
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

  addServerMiddleware(middleware) {
    this.options.serverMiddleware.push(middleware)
  }

  extendBuild(fn) {
    this.options.build.extend = chainFn(this.options.build.extend, fn)
  }

  extendRoutes(fn) {
    this.options.router.extendRoutes = chainFn(this.options.router.extendRoutes, fn)
  }

  requireModule(moduleOpts) {
    // Require once
    return this.addModule(moduleOpts, true)
  }

  async addModule(moduleOpts, requireOnce) {
    /* istanbul ignore if */
    if (!moduleOpts) {
      return
    }

    // Allow using babel style array options
    if (Array.isArray(moduleOpts)) {
      moduleOpts = {
        src: moduleOpts[0],
        options: moduleOpts[1]
      }
    }

    // Allows passing runtime options to each module
    const options = moduleOpts.options || (typeof moduleOpts === 'object' ? moduleOpts : {})
    const src = moduleOpts.src || moduleOpts

    // Resolve module
    let module
    if (typeof src === 'string') {
      module = require(this.nuxt.resolvePath(src))
    }

    // Validate module
    /* istanbul ignore if */
    if (typeof module !== 'function') {
      throw new Error(`[nuxt] Module ${JSON.stringify(src)} should export a function`)
    }

    // Module meta
    module.meta = module.meta || {}
    let name = module.meta.name || module.name

    // If requireOnce specified & module from NPM or with specified name
    if (requireOnce && name) {
      const alreadyRequired = this.requiredModules.indexOf(name) !== -1
      if (requireOnce && alreadyRequired) {
        return
      }
      if (!alreadyRequired) {
        this.requiredModules.push(name)
      }
    }

    // Call module with `this` context and pass options
    await new Promise((resolve, reject) => {
      const result = module.call(this, options, (err) => {
        /* istanbul ignore if */
        if (err) {
          return reject(err)
        }
        resolve()
      })
      // If module send back a promise
      if (result && result.then instanceof Function) {
        return result.then(resolve)
      }
      // If not expecting a callback but returns no promise (=synchronous)
      if (module.length < 2) {
        return resolve()
      }
    })
  }
}
