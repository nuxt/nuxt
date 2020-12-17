import path from 'path'

const localNodeModules = path.resolve(process.cwd(), 'node_modules')

// Prefer importing modules from local node_modules (for NPX and global bin)
async function _import (modulePath) {
  for (const mp of [
    path.resolve(localNodeModules, modulePath),
    modulePath
  ]) {
    try {
      return await import(mp)
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') {
        throw e
      }
    }
  }

  const error = new Error(`Cannot import module '${modulePath}'`)
  error.code = 'MODULE_NOT_FOUND'
  throw error
}

const NuxtDeps = () => (global.__NUXT_DEPS__ || {})

export const builder = () => NuxtDeps().builder || _import('@nuxt/builder')
export const webpack = () => NuxtDeps().webpack || _import('@nuxt/webpack')
export const generator = () => NuxtDeps().generator || _import('@nuxt/generator')
export const core = () => NuxtDeps().core || _import('@nuxt/core')
export const server = () => NuxtDeps().server || _import('@nuxt/server')

export const importModule = _import
