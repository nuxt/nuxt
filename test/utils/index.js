import path from 'path'
import fs from 'fs'
import klawSync from 'klaw-sync'

import _getPort from 'get-port'
import { defaultsDeep, find } from 'lodash'
import _rp from 'request-promise-native'
import corePkg from '../../packages/core/package.json'

import * as _Utils from '../../packages/common/src/index'

export { Nuxt } from '../../packages/core/src/index'
export { Builder, Generator } from '../../packages/builder/src/index'

export const rp = _rp
export const getPort = _getPort
export const version = corePkg.version

export const Utils = _Utils
export const Options = _Utils.Options

export const loadFixture = async function (fixture, overrides) {
  const rootDir = path.resolve(__dirname, '..', 'fixtures', fixture)
  const configFile = path.resolve(rootDir, 'nuxt.config.js')

  const config = fs.existsSync(configFile) ? (await import(`../fixtures/${fixture}/nuxt.config`)).default : {}

  config.rootDir = rootDir
  config.dev = false

  return defaultsDeep({}, overrides, config)
}

/**
 * Prepare an object to pass to the createSportsSelectionView function
 * @param {Function} condition return true to stop the waiting
 * @param {Number} duration seconds totally wait
 * @param {Number} interval milliseconds interval to check the condition
 *
 * @returns {Boolean} true: timeout, false: condition becomes true within total time
 */
export const waitUntil = async function waitUntil(condition, duration = 20, interval = 250) {
  let iterator = 0
  const steps = Math.floor(duration * 1000 / interval)

  while (!condition() && iterator < steps) {
    await Utils.waitFor(interval)
    iterator++
  }

  if (iterator === steps) {
    return true
  }
  return false
}

export const listPaths = function listPaths(dir, pathsBefore = [], options = {}) {
  if (Array.isArray(pathsBefore) && pathsBefore.length) {
    // only return files that didn't exist before building
    // and files that have been changed
    options.filter = (item) => {
      const foundItem = find(pathsBefore, (itemBefore) => {
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
