
import path from 'path'
import { defaultsDeep } from 'lodash'
import { version as coreVersion } from '../../packages/core/package.json'
import { loadNuxtConfig } from '../../packages/config/src/index'

export { Nuxt } from '../../packages/core/src/index'
export { Builder } from '../../packages/builder/src/index'
export { Generator } from '../../packages/generator/src/index'
export { BundleBuilder } from '../../packages/webpack/src/index'
export * from '../../packages/utils/src/index'

export const version = `v${coreVersion}`

export const loadFixture = async function (fixture, overrides) {
  const rootDir = path.resolve(__dirname, '..', 'fixtures', fixture)
  const config = await loadNuxtConfig({
    rootDir,
    configOverrides: {
      dev: false,
      test: true
    }
  })

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
