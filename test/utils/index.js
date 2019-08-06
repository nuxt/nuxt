import klawSync from 'klaw-sync'

export { getNuxtConfig } from '../../packages/config'
export { default as getPort } from 'get-port'
export { default as rp } from 'request-promise-native'

export * from './nuxt'

export const listPaths = function listPaths (dir, pathsBefore = [], options = {}) {
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

export const equalOrStartsWith = function equalOrStartsWith (string1, string2) {
  return string1 === string2 || string2.startsWith(string1)
}
