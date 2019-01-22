import Module from 'module'
import { resolve, join } from 'path'
import fs from 'fs-extra'
import consola from 'consola'
import esm from 'esm'

import { startsWithRootAlias, startsWithSrcAlias } from '@nuxt/utils'

export default class Resolver {
  constructor(nuxt) {
    this.nuxt = nuxt
    this.options = this.nuxt.options

    // Binds
    this.resolvePath = this.resolvePath.bind(this)
    this.resolveAlias = this.resolveAlias.bind(this)
    this.resolveModule = this.resolveModule.bind(this)
    this.requireModule = this.requireModule.bind(this)

    // ESM Loader
    this.esm = esm(module, {})
  }

  resolveModule(path) {
    try {
      return Module._resolveFilename(path, {
        paths: this.options.modulesDir
      })
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        return undefined
      } else {
        throw error
      }
    }
  }

  resolveAlias(path) {
    if (startsWithRootAlias(path)) {
      return join(this.options.rootDir, path.substr(2))
    }

    if (startsWithSrcAlias(path)) {
      return join(this.options.srcDir, path.substr(1))
    }

    return resolve(this.options.srcDir, path)
  }

  resolvePath(path, { alias, isAlias = alias, module, isModule = module, isStyle } = {}) {
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

      if (isDirectory && fs.existsSync(resolvedPath + '/index.' + ext)) {
        return resolvedPath + '/index.' + ext
      }
    }

    // If there's no index.[ext] we just return the directory path
    if (isDirectory) {
      return resolvedPath
    }

    // Give up
    throw new Error(`Cannot resolve "${path}" from "${resolvedPath}"`)
  }

  requireModule(path, { esm, useESM = esm, alias, isAlias = alias, intropDefault } = {}) {
    let resolvedPath = path
    let requiredModule

    // TODO: Remove in Nuxt 3
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

    // Disable esm for ts files by default
    if (useESM === undefined && /.ts$/.test(resolvedPath)) {
      useESM = false
    }

    // Try to require
    try {
      if (useESM === false) {
        requiredModule = require(resolvedPath)
      } else {
        requiredModule = this.esm(resolvedPath)
      }
    } catch (e) {
      lastError = e
    }

    // Introp default
    if (intropDefault !== false && requiredModule && requiredModule.default) {
      requiredModule = requiredModule.default
    }

    // Throw error if failed to require
    if (requiredModule === undefined && lastError) {
      throw lastError
    }

    return requiredModule
  }
}
