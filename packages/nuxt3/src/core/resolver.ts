import { resolve, join } from 'path'
import fs from 'fs-extra'
import consola from 'consola'

import {
  startsWithRootAlias,
  startsWithSrcAlias,
  isExternalDependency,
  clearRequireCache
} from 'nuxt/utils'

export default class Resolver {
  constructor (nuxt) {
    this.nuxt = nuxt
    this.options = this.nuxt.options

    // Binds
    this.resolvePath = this.resolvePath.bind(this)
    this.resolveAlias = this.resolveAlias.bind(this)
    this.resolveModule = this.resolveModule.bind(this)
    this.requireModule = this.requireModule.bind(this)

    const { createRequire } = this.options
    this._require = createRequire ? createRequire(module) : module.require

    this._resolve = require.resolve
  }

  resolveModule (path) {
    try {
      return this._resolve(path, {
        paths: this.options.modulesDir
      })
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') {
        // TODO: remove after https://github.com/facebook/jest/pull/8487 released
        if (process.env.NODE_ENV === 'test' && error.message.startsWith('Cannot resolve module')) {
          return
        }
        throw error
      }
    }
  }

  resolveAlias (path) {
    if (startsWithRootAlias(path)) {
      return join(this.options.rootDir, path.substr(2))
    }

    if (startsWithSrcAlias(path)) {
      return join(this.options.srcDir, path.substr(1))
    }

    return resolve(this.options.srcDir, path)
  }

  resolvePath (path, { alias, isAlias = alias, module, isModule = module, isStyle } = {}) {
    // TODO: Remove in Nuxt 3
    if (alias) {
      consola.warn('Using alias is deprecated and will be removed in Nuxt 3. Use `isAlias` instead.')
    }
    if (module) {
      consola.warn('Using module is deprecated and will be removed in Nuxt 3. Use `isModule` instead.')
    }

    // Fast return in case of path exists
    if (fs.existsSync(path)) {
      return path
    }

    let resolvedPath

    // Try to resolve it as a regular module
    if (isModule !== false) {
      resolvedPath = this.resolveModule(path)
    }

    // Try to resolve alias
    if (!resolvedPath && isAlias !== false) {
      resolvedPath = this.resolveAlias(path)
    }

    // Use path for resolvedPath
    if (!resolvedPath) {
      resolvedPath = path
    }

    let isDirectory

    // Check if resolvedPath exits and is not a directory
    if (fs.existsSync(resolvedPath)) {
      isDirectory = fs.lstatSync(resolvedPath).isDirectory()

      if (!isDirectory) {
        return resolvedPath
      }
    }

    const extensions = isStyle ? this.options.styleExtensions : this.options.extensions

    // Check if any resolvedPath.[ext] or resolvedPath/index.[ext] exists
    for (const ext of extensions) {
      if (!isDirectory && fs.existsSync(resolvedPath + '.' + ext)) {
        return resolvedPath + '.' + ext
      }

      const resolvedPathwithIndex = join(resolvedPath, 'index.' + ext)
      if (isDirectory && fs.existsSync(resolvedPathwithIndex)) {
        return resolvedPathwithIndex
      }
    }

    // If there's no index.[ext] we just return the directory path
    if (isDirectory) {
      return resolvedPath
    }

    // Give up
    throw new Error(`Cannot resolve "${path}" from "${resolvedPath}"`)
  }

  requireModule (path, { esm, useESM = esm, alias, isAlias = alias, intropDefault, interopDefault = intropDefault } = {}) {
    let resolvedPath = path
    let requiredModule

    // TODO: Remove in Nuxt 3
    if (intropDefault) {
      consola.warn('Using intropDefault is deprecated and will be removed in Nuxt 3. Use `interopDefault` instead.')
    }
    if (alias) {
      consola.warn('Using alias is deprecated and will be removed in Nuxt 3. Use `isAlias` instead.')
    }
    if (esm) {
      consola.warn('Using esm is deprecated and will be removed in Nuxt 3. Use `useESM` instead.')
    }

    let lastError

    // Try to resolve path
    try {
      resolvedPath = this.resolvePath(path, { isAlias })
    } catch (e) {
      lastError = e
    }

    const isExternal = isExternalDependency(resolvedPath)

    // in dev mode make sure to clear the require cache so after
    // a dev server restart any changed file is reloaded
    if (this.options.dev && !isExternal) {
      clearRequireCache(resolvedPath)
    }

    // By default use esm only for js,mjs files outside of node_modules
    if (useESM === undefined) {
      useESM = !isExternal && /.(js|mjs)$/.test(resolvedPath)
    }

    // Try to require
    try {
      if (useESM) {
        requiredModule = this._require(resolvedPath)
      } else {
        requiredModule = require(resolvedPath)
      }
    } catch (e) {
      lastError = e
    }

    // Interop default
    if (interopDefault !== false && requiredModule && requiredModule.default) {
      requiredModule = requiredModule.default
    }

    // Throw error if failed to require
    if (requiredModule === undefined && lastError) {
      throw lastError
    }

    return requiredModule
  }
}
