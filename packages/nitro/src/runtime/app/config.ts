import destr from 'destr'
import defu from 'defu'

// Bundled runtime config (injected by nitro)
const _runtimeConfig = process.env.RUNTIME_CONFIG as any

// Allow override from process.env and deserialize
for (const type of ['private', 'public']) {
  for (const key in _runtimeConfig[type]) {
    _runtimeConfig[type][key] = destr(process.env[key] || _runtimeConfig[type][key])
  }
}

// Named exports
export const privateConfig = deepFreeze(defu(_runtimeConfig.private, _runtimeConfig.public))
export const publicConfig = deepFreeze(_runtimeConfig.public)

// Default export (usable for server)
export default privateConfig

// Utils
function deepFreeze (object: Record<string, any>) {
  const propNames = Object.getOwnPropertyNames(object)
  for (const name of propNames) {
    const value = object[name]
    if (value && typeof value === 'object') {
      deepFreeze(value)
    }
  }
  return Object.freeze(object)
}
