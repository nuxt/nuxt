import path from 'path'
import fs from 'fs'

import _getPort from 'get-port'
import { defaultsDeep } from 'lodash'
import _rp from 'request-promise-native'

import { requireModule } from '../../lib/common/module'
import { version as _version } from '../../package.json'

import {
  Nuxt as _Nuxt,
  Utils as _Utils,
  Options as _Options,
  Builder as _Builder,
  Generator as _Generator
} from '../../dist/nuxt-test'

export const rp = _rp
export const getPort = _getPort
export const version = _version

export const Nuxt = _Nuxt
export const Utils = _Utils
export const Options = _Options
export const Builder = _Builder
export const Generator = _Generator

export function loadFixture(fixture, overrides) {
  const rootDir = path.resolve(__dirname, '../fixtures/' + fixture)
  const configFile = path.resolve(rootDir, 'nuxt.config.js')

  const config = fs.existsSync(configFile) ? requireModule(configFile) : {}

  config.rootDir = rootDir
  config.dev = false

  return defaultsDeep({}, overrides, config)
}
