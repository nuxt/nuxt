
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
  const configFile = path.resolve(rootDir, `nuxt.config${process.env.NUXT_TS === 'true' ? '.ts' : '.js'}`)

  let config = fs.existsSync(configFile) ? (await import(`../fixtures/${fixture}/nuxt.config`)).default : {}
  if (typeof config === 'function') {
    config = await config()
  }

  config.rootDir = rootDir
  config.dev = false
  config.test = true

  return defaultsDeep({}, overrides, config)
}
