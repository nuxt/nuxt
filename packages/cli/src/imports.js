import path from 'path'

const localNodeModules = path.resolve(process.cwd(), 'node_modules')

// Prefer importing modules from local node_modules (for NPX and global bin)
async function _import(modulePath) {
  let m
  try {
    m = await import(path.resolve(localNodeModules, modulePath))
  } catch (e) {
    m = await import(modulePath)
  }
  return m
}

export const builder = () => _import('@nuxt/builder')
export const webpack = () => _import('@nuxt/webpack')
export const generator = () => _import('@nuxt/generator')
export const core = () => _import('@nuxt/core')
