
import path from 'path'
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

  try {
    config = await import(`../fixtures/${fixture}/nuxt.config`)
    config = config.default || config
  } catch (e) {
    // Ignore MODULE_NOT_FOUND
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw e
    }
  }

  if (typeof config === 'function') {
    config = await config()
  }

  config.rootDir = rootDir
  config.dev = false
  config.test = true

  // disable terser to speed-up fixture builds
  if (config.build) {
    if (!config.build.terser) {
      config.build.terser = false
    }
  } else {
    config.build = { terser: false }
  }

  return defaultsDeep({}, overrides, config)
}
