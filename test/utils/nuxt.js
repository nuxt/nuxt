
export { Nuxt } from '../../packages/core/src/index'
export { Builder, Generator } from '../../packages/builder/src/index'
import corePkg from '../../packages/core/package.json'
export const version = corePkg.version
export const Options = _Utils.Options
