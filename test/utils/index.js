import klawSync from 'klaw-sync'
import { waitFor } from '../../packages/utils'

export { getNuxtConfig } from '../../packages/config'
export { default as getPort } from 'get-port'
export { default as rp } from 'request-promise-native'

export * from './nuxt'

// Pauses execution for a determined amount of time (`duration`)
// until `condition` is met. Also allows specifying the `interval`
// at which the condition is checked during the waiting period.
export const waitUntil = async function waitUntil(condition, duration = 20, interval = 250) {
  let iterator = 0
  const steps = Math.floor(duration * 1000 / interval)

  while (!condition() && iterator < steps) {
    await waitFor(interval)
    iterator++
  }

  if (iterator === steps) {
    return true
  }
  return false
}

export const listPaths = function listPaths(dir, pathsBefore = [], options = {}) {
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

export const equalOrStartsWith = function equalOrStartsWith(string1, string2) {
  return string1 === string2 || string2.startsWith(string1)
}
