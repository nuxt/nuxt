'use strict'

import path from 'path'
import fs from 'fs'
import {uniq} from 'lodash'
import hash from 'hash-sum'
import {chainFn, sequence} from './utils'

const debug = require('debug')('nuxt:module')

class Module {
  constructor (nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options
    this.modules = []
    this.initialized = false
  }

  async init () {
    if (this.initialized) {
      debug('[nuxt] Modules are already initialized')
      return
    }
    // Install all modules in sequence
    await sequence(this.options.modules, this.addModule.bind(this))
    // Indicate modules are already initialized
    this.initialized = true
  }

  addVendor (vendor) {
    /* istanbul ignore if */
    if (!vendor) {
      return
    }
    this.options.build.vendor = uniq(this.options.build.vendor.concat(vendor))
  }

  addTemplate (template) {
    /* istanbul ignore if */
    if (!template) {
      return
    }
    // Validate & parse source
    const src = template.src || template
    const srcPath = path.parse(src)
    /* istanbul ignore if */
    if (!src || typeof src !== 'string' || !fs.existsSync(src)) {
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

  addPlugin (template) {
    const {dst} = this.addTemplate(template)
    // Add to nuxt plugins
    this.options.plugins.push({
      src: path.join(this.nuxt.buildDir, dst),
      ssr: template.ssr
    })
  }

  addServerMiddleware (middleware) {
    this.options.serverMiddleware.push(middleware)
  }

  extendBuild (fn) {
    this.options.build.extend = chainFn(this.options.build.extend, fn)
  }

  extendRoutes (fn) {
    this.options.router.extendRoutes = chainFn(this.options.router.extendRoutes, fn)
  }

  requireModule (moduleOpts) {
    if (this.modules.indexOf(moduleOpts) !== -1 || this.modules.indexOf(moduleOpts.src) !== -1) {
      return false
    }
    this.modules.push(moduleOpts.src || moduleOpts)
    return this.addModule(moduleOpts)
  }

  addModule (moduleOpts) {
    /* istanbul ignore if */
    if (!moduleOpts) {
      return
    }
    // Allow using babel style array options
    if(Array.isArray(moduleOpts)) {
      moduleOpts = {
        src: moduleOpts[0],
        options: moduleOpts[1]
      }
    }
    // Allows passing runtime options to each module
    const options = moduleOpts.options || (typeof moduleOpts === 'object' ? moduleOpts : {})
    const originalSrc = moduleOpts.src || moduleOpts
    // Resolve module
    let module = originalSrc
    try {
      if (typeof module === 'string') {
        // Using ~ or ./ shorthand modules are resolved from project srcDir
        if (module.indexOf('~') === 0 || module.indexOf('./') === 0) {
          module = path.join(this.options.srcDir, module.substr(1))
        }
        // eslint-disable-next-line no-eval
        module = eval('require')(module)
      }
    } catch (e) /* istanbul ignore next */ {
      // eslint-disable-next-line no-console
      console.error('[nuxt] Unable to resolve module', module)
      // eslint-disable-next-line no-console
      console.error(e)
      process.exit(0)
    }
    // Validate module
    /* istanbul ignore if */
    if (typeof module !== 'function') {
      // eslint-disable-next-line no-console
      console.error(`[nuxt] Module [${originalSrc}] should export a function`)
      process.exit(1)
    }
    // Call module with `this` context and pass options
    return new Promise((resolve, reject) => {
      const result = module.call(this, options, err => {
        /* istanbul ignore if */
        if (err) {
          return reject(err)
        }
        resolve(module)
      })
      // If module send back a promise
      if (result && result.then instanceof Function) {
        return result.then(resolve)
      }
      // If not expecting a callback but returns no promise (=synchronous)
      if (module.length < 2) {
        return resolve(module)
      }
    })
  }
}

export default Module
