'use strict'

import path from 'path'
import fs from 'fs'
import {uniq} from 'lodash'
import hash from 'hash-sum'

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

  addTemplate (template) {
    if (!template) {
      return
    }
    // Validate & parse source
    const src = template.src || template
    const srcPath = path.parse(src)
    if (!src || typeof src !== 'string' || !fs.existsSync(src)) {
      // eslint-disable-next-line no-console
      console.warn('[Nuxt] invalid template', template)
      return
    }
    // Generate unique and human readable dst filename
    const dst = template.dst ||
      ((template.dstName || (path.basename(srcPath.dir) + '.' + srcPath.name)) + '.' + hash(src) + (template.dstExt || srcPath.ext))

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
      src: '~/.nuxt/' + dst,
      ssr: Boolean(template.ssr)
    })
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
    let src = moduleOpts.src || moduleOpts
    // Resolve module
    let module
    try {
      if (typeof src === 'string') {
        // Using ~ shorthand modules are resolved from project srcDir
        if (src.indexOf('~') === 0) {
          src = path.resolve(this.options.srcDir, src.substr(1))
        }
        // eslint-disable-next-line no-eval
        module = eval('require')(src)
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[Nuxt] Unable to resolve module', src)
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
      return module.call(this, options, err => {
        if (err) {
          return reject(err)
        }
        resolve(module)
      })
    })
  }
}

export default Module
