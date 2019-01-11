import path from 'path'
import consola from 'consola'

const localNodeModules = path.resolve(process.cwd(), 'node_modules')

// Prefer importing modules from local node_modules (for NPX and global bin)
async function _import(modulePath) {
  let m
  try {
    m = await import(path.resolve(localNodeModules, modulePath))
  } catch (e) {
    try {
      m = await import(modulePath)
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND')
        consola.fatal(
          `Module ${modulePath} not found.`,
          '\n\n',
          `Please install missing dependency:`,
          '\n\n',
          `Using npm:  npm i ${modulePath}`,
          '\n\n',
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
