'use strict'

import path from 'path'
import fs from 'fs'
import {uniq} from 'lodash'

class Module {
  constructor (nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options
  }

  addVendor (vendor) {
    if (!vendor) {
      return
    }
    this.options.build.vendor = uniq(this.options.build.vendor.concat(vendor))
  }

  addPlugin (plugin) {
    if (!plugin) {
      return
    }
    const ssr = Boolean(plugin.ssr)
    const copyOnly = Boolean(plugin.copyOnly)
    const src = plugin.src || plugin
    if (!src || typeof src !== 'string' || !fs.existsSync(src)) {
      // eslint-disable-next-line no-console
      console.warn('[Nuxt] invalid plugin', plugin)
      return
    }
    // Copy plugin to project
    const fileName = path.basename(src)
    // TODO: Build removes this?
    const dst = path.resolve(this.nuxt.rootDir, '.nuxt', fileName)
    fs.copySync(src, dst)
    // Add to nuxt plugins
    if (!copyOnly) {
      this.options.plugins.push({src: dst, ssr})
    }
  }

  extendBuild (extendFn) {
    if (!(extendFn instanceof Function)) {
      return
    }
    // Add extendFn to chain
    const _extend = this.options.build.extend
    this.options.build.extend = function () {
      extendFn.apply(this, arguments)
      if (_extend) {
        _extend.apply(this, arguments)
      }
    }
  }

  installModule (moduleOpts) {
    if (!moduleOpts) {
      return
    }
    // Allows passing runtime options to each module
    const options = moduleOpts.options || {}
    const src = moduleOpts.src || moduleOpts
    // Resolve module
    let module
    try {
      if (typeof src === 'string') {
        // Using ~ shorthand modules are resolved from project srcDir
        if (src.indexOf('~') === 0) {
          module = require(path.resolve(this.options.srcDir, src.substr(1)))
        } else {
          module = require(src)
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[Nuxt] Unable to resolve module', module)
      // eslint-disable-next-line no-console
      console.error(e)
      return
    }
    // Validate module
    if (!(module instanceof Function)) {
      // eslint-disable-next-line no-console
      console.error('[Nuxt] Module should be a function', module)
    }
    // Call module with `this` context and pass options
    return new Promise((resolve, reject) => {
      return module.apply(this, options, err => {
        if (err) {
          return reject(err)
        }
        resolve(module)
      })
    })
  }
}

export default Module
