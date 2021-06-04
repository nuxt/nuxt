import destr from 'destr'
import defu from 'defu'

// Bundled runtime config
export const runtimeConfig = process.env.RUNTIME_CONFIG as any

// Allow override from process.env and deserialize
for (const type of ['private', 'public']) {
  for (const key in runtimeConfig[type]) {
    runtimeConfig[type][key] = destr(process.env[key] || runtimeConfig[type][key])
  }
}

// Export merged config
export const config = defu(runtimeConfig.private, runtimeConfig.public)
export default config
