import klawSync from 'klaw-sync'
import got from 'got'

export { getNuxtConfig } from '../../packages/config'
export { default as getPort } from 'get-port'

export * from './nuxt'
export * from './resource-size'

export function listPaths (dir, pathsBefore = [], options = {}) {
  if (Array.isArray(pathsBefore) && pathsBefore.length) {
    // Only return files that didn't exist before building
    // and files that have been changed
    options.filter = (item) => {
      const foundItem = pathsBefore.find((itemBefore) => {
        return item.path === itemBefore.path
      })
      return typeof foundItem === 'undefined' ||
        item.stats.mtimeMs !== foundItem.stats.mtimeMs
    }
  }

  return klawSync(dir, options)
}

export function equalOrStartsWith (string1, string2) {
  return string1 === string2 || string2.startsWith(string1)
}

export const rp = got.extend({ decompress: false })
