import path from 'path'
import fs from 'fs'

import _getPort from 'get-port'
import { defaultsDeep } from 'lodash'
import _rp from 'request-promise-native'
import pkg from '../../package.json'
import * as Dist from '../../lib/nuxt'

export const rp = _rp
export const getPort = _getPort
export const version = pkg.version

export const Nuxt = Dist.Nuxt
export const Utils = Dist.Utils
export const Options = Dist.Options
export const Builder = Dist.Builder
export const Generator = Dist.Generator

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
