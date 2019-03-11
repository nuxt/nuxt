import path from 'path'
import consola from 'consola'

const localNodeModules = path.resolve(process.cwd(), 'node_modules')

// Prefer importing modules from local node_modules (for NPX and global bin)
async function _import(modulePath) {
  let m
  for (const mp of [ path.resolve(localNodeModules, modulePath), modulePath ]) {
    try {
      m = await import(mp)
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') {
        throw e
      } else if (mp === modulePath) {
        consola.fatal(
          `Module ${modulePath} not found.\n\n`,
          `Please install missing dependency:\n\n`,
          `Using npm:  npm i ${modulePath}\n\n`,
          `Using yarn: yarn add ${modulePath}`
        )
      }
    }
  }
  return m
}

export const builder = () => _import('@nuxt/builder')
export const webpack = () => _import('@nuxt/webpack')
export const generator = () => _import('@nuxt/generator')
export const core = () => _import('@nuxt/core')
export const importModule = _import
