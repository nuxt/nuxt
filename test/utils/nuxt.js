
import path from 'path'
import fs from 'fs'
import { defaultsDeep } from 'lodash'
import { version as coreVersion } from '../../packages/core/package.json'

export { Nuxt } from '../../packages/core/src/index'
export { Builder } from '../../packages/builder/src/index'
export { Generator } from '../../packages/generator/src/index'
export { BundleBuilder } from '../../packages/webpack/src/index'
export * from '../../packages/utils/src/index'

export const version = `v${coreVersion}`

export const loadFixture = async function (fixture, overrides) {
  const rootDir = path.resolve(__dirname, '..', 'fixtures', fixture)
  let config = {}

  for (const ext of ['ts', 'js']) {
    const configFile = path.resolve(rootDir, `nuxt.config.${ext}`)
    if (fs.existsSync(configFile)) {
      config = await import(`../fixtures/${fixture}/nuxt.config`)
      config = config.default || config
      break
    }
  }

  if (typeof config === 'function') {
    config = await config()
  }

  config.rootDir = rootDir
  config.dev = false
  config.test = true

  return defaultsDeep({}, overrides, config)
}
