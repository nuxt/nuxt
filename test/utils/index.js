import path from 'path'
import fs from 'fs'
import _getPort from 'get-port'

import { requireModule } from '../../lib/common/module'

export function loadFixture(fixture, overrides) {
  const rootDir = path.resolve(__dirname, '../fixtures/' + fixture)
  const configFile = path.resolve(rootDir, 'nuxt.config.js')

  const config = fs.existsSync(configFile) ? requireModule(configFile) : {}

  config.rootDir = rootDir
  config.dev = false

  return Object.assign({}, config, overrides)
}

export function getPort() {
  return _getPort()
}
