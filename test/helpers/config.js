import { resolve } from 'path'

import { requireModule } from '../../lib/common/module'

export function loadConfig(fixture, overrides) {
  const rootDir = resolve(__dirname, '../fixtures/' + fixture)

  const config = requireModule(resolve(rootDir, 'nuxt.config.js'))

  return Object.assign({ rootDir }, config, overrides)
}
